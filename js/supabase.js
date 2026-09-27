// ============================================================
// supabase.js — Shared storefront data and authentication
// ============================================================

let marchicaSupabase = null;
let marchicaAdmin = false;
let marchicaBackendReady = false;

const SHARED_STORAGE_KEYS = new Map([
    [STORAGE_KEYS.PRODUCTS, 'products'],
    [STORAGE_KEYS.CATEGORIES, 'categories'],
    [STORAGE_KEYS.HERO_SLIDES, 'hero_slides'],
    [STORAGE_KEYS.SHOP_SETTINGS, 'shop_settings']
]);
const sharedWriteQueues = new Map();

function supabaseIsConfigured() {
    const config = window.MARCHICA_SUPABASE_CONFIG;
    return !!config &&
        /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url) &&
        typeof config.anonKey === 'string' &&
        config.anonKey.length > 20 &&
        !config.anonKey.startsWith('YOUR_');
}

function isSupabaseConnected() {
    return marchicaBackendReady;
}

function isSupabaseAdmin() {
    return marchicaAdmin;
}

function backendErrorMessage(error) {
    return error && typeof error.message === 'string' ? error.message : String(error);
}

function notifyBackendError(action, error) {
    console.error(`Supabase ${action} error:`, error);
    if (typeof showToast === 'function') {
        const message = error?.code === 'PGRST205'
            ? 'Projet Supabase trouvé, mais la base Marchica n’est pas initialisée. Exécutez supabase/schema.sql dans le SQL Editor.'
            : `Erreur backend (${action}) : ${backendErrorMessage(error)}`;
        showToast(message, 'error');
    }
}

function reportBackgroundError(action, error) {
    notifyBackendError(action, error);
}

async function initializeSupabaseBackend() {
    if (!supabaseIsConfigured()) return false;
    if (!window.supabase || typeof window.supabase.createClient !== 'function') {
        throw new Error('La bibliothèque Supabase ne s’est pas chargée. Vérifiez votre connexion réseau.');
    }

    const config = window.MARCHICA_SUPABASE_CONFIG;
    marchicaSupabase = window.supabase.createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data: { session }, error: sessionError } = await marchicaSupabase.auth.getSession();
    if (sessionError) throw sessionError;
    marchicaAdmin = !!session && session.user.app_metadata?.store_role === 'admin';

    await loadSharedStorefrontData();
    marchicaBackendReady = true;
    return true;
}

function storeRawValue(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

async function loadSharedStorefrontData() {
    const publicKeys = ['products', 'categories', 'hero_slides', 'shop_settings'];
    const { data, error } = await marchicaSupabase
        .from('storefront_data')
        .select('key,value')
        .in('key', publicKeys);
    if (error) throw error;

    const remoteKeys = new Set(data.map(row => row.key));
    const localEntries = [
        ['products', STORAGE_KEYS.PRODUCTS],
        ['categories', STORAGE_KEYS.CATEGORIES],
        ['hero_slides', STORAGE_KEYS.HERO_SLIDES],
        ['shop_settings', STORAGE_KEYS.SHOP_SETTINGS]
    ];

    for (const row of data) {
        const storageKey = localEntries.find(([remoteKey]) => remoteKey === row.key)?.[1];
        if (storageKey) storeRawValue(storageKey, row.value);
    }

    if (marchicaAdmin) {
        for (const [remoteKey, storageKey] of localEntries) {
            if (!remoteKeys.has(remoteKey)) {
                const value = getFromStorage(storageKey, null);
                if (value !== null) await writeSharedData(storageKey, value);
            }
        }

        const { data: existingReviews, error: reviewsError } = await marchicaSupabase
            .from('product_reviews').select('id');
        if (reviewsError) throw reviewsError;
        const localReviews = getFromStorage(STORAGE_KEYS.REVIEWS, []);
        const reviewIds = new Set(existingReviews.map(row => row.id));
        const missingReviews = localReviews.filter(review => !reviewIds.has(review.id));
        if (missingReviews.length) {
            for (const review of missingReviews) {
                const { error } = await marchicaSupabase.from('product_reviews').upsert({
                    id: review.id,
                    product_id: review.productId,
                    customer_name: review.name,
                    rating: review.rating,
                    comment: review.comment,
                    approved: review.approved,
                    created_at: review.date
                });
                if (error) throw error;
            }
        }

        const { data: existingOrders, error: ordersError } = await marchicaSupabase
            .from('orders').select('order_id');
        if (ordersError) throw ordersError;
        const localOrders = getFromStorage(STORAGE_KEYS.ORDERS, []);
        const orderIds = new Set(existingOrders.map(row => row.order_id));
        const missingOrders = localOrders.filter(order => !orderIds.has(order.orderId));
        if (missingOrders.length) await syncOrderChanges(missingOrders);

        await loadReviewsFromSupabase(true);
        await loadOrdersFromSupabase();
    } else {
        await loadReviewsFromSupabase(false);
    }
}

async function uploadDataUrl(imageData, folder) {
    const response = await fetch(imageData);
    if (!response.ok) throw new Error('Impossible de lire une image téléversée.');
    const blob = await response.blob();
    const extension = blob.type.split('/')[1] || 'jpg';
    const filename = `${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await marchicaSupabase.storage
        .from('store-assets')
        .upload(filename, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    const { data } = marchicaSupabase.storage.from('store-assets').getPublicUrl(filename);
    return data.publicUrl;
}

async function prepareSharedValue(value, key) {
    const copy = structuredClone(value);
    const folder = key === STORAGE_KEYS.PRODUCTS ? 'products' : 'banners';

    async function replaceDataUrls(item) {
        if (Array.isArray(item)) {
            for (let i = 0; i < item.length; i++) item[i] = await replaceDataUrls(item[i]);
            return item;
        }
        if (item && typeof item === 'object') {
            for (const prop of Object.keys(item)) item[prop] = await replaceDataUrls(item[prop]);
            return item;
        }
        if (typeof item === 'string' && item.startsWith('data:image/')) {
            return uploadDataUrl(item, folder);
        }
        return item;
    }

    return replaceDataUrls(copy);
}

async function writeSharedData(storageKey, value) {
    if (!marchicaSupabase || !marchicaAdmin) {
        throw new Error('Connectez-vous à l’espace propriétaire pour modifier les données partagées.');
    }
    const remoteKey = SHARED_STORAGE_KEYS.get(storageKey);
    if (!remoteKey) return;
    const remoteValue = await prepareSharedValue(value, storageKey);
    const { error } = await marchicaSupabase
        .from('storefront_data')
        .upsert({ key: remoteKey, value: remoteValue, updated_at: new Date().toISOString() });
    if (error) throw error;

    if (JSON.stringify(remoteValue) !== JSON.stringify(value)) {
        storeRawValue(storageKey, remoteValue);
    }
}

function syncSharedData(storageKey, value) {
    if (!marchicaBackendReady || !SHARED_STORAGE_KEYS.has(storageKey)) return;
    const previous = sharedWriteQueues.get(storageKey) || Promise.resolve();
    const next = previous
        .catch(() => {})
        .then(() => writeSharedData(storageKey, value));
    sharedWriteQueues.set(storageKey, next);
    next.catch(error => reportBackgroundError('sauvegarde', error))
        .finally(() => {
            if (sharedWriteQueues.get(storageKey) === next) sharedWriteQueues.delete(storageKey);
        });
}

async function supabaseAdminLogin(email, password) {
    if (!marchicaSupabase) throw new Error('Supabase n’est pas configuré. Vérifiez js/supabase-config.js.');
    const { data, error } = await marchicaSupabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user.app_metadata?.store_role !== 'admin') {
        await marchicaSupabase.auth.signOut();
        throw new Error('Ce compte n’a pas les droits propriétaire.');
    }
    marchicaAdmin = true;
    await loadSharedStorefrontData();
    return true;
}

async function supabaseAdminLogout() {
    if (!marchicaSupabase) return;
    const { error } = await marchicaSupabase.auth.signOut();
    if (error) throw error;
    marchicaAdmin = false;
    storeRawValue(STORAGE_KEYS.ORDERS, []);
    await loadReviewsFromSupabase(false);
}

async function loadReviewsFromSupabase(includePending) {
    const cachedReviews = getFromStorage(STORAGE_KEYS.REVIEWS, []);
    const query = marchicaSupabase.from('product_reviews').select('*').order('created_at', { ascending: false });
    if (!includePending) query.eq('approved', true);
    const { data, error } = await query;
    if (error) throw error;
    const reviews = data.map(row => ({
        id: row.id,
        productId: row.product_id,
        name: row.customer_name,
        rating: row.rating,
        comment: row.comment,
        date: row.created_at,
        approved: row.approved
    }));
    if (!includePending) {
        const loadedIds = new Set(reviews.map(review => review.id));
        reviews.push(...cachedReviews.filter(review => !loadedIds.has(review.id)));
    }
    storeRawValue(STORAGE_KEYS.REVIEWS, reviews);
}

async function submitReviewToSupabase(review) {
    if (!marchicaBackendReady) return;
    const { error } = await marchicaSupabase.from('product_reviews').insert({
        id: review.id,
        product_id: review.productId,
        customer_name: review.name,
        rating: review.rating,
        comment: review.comment,
        approved: false,
        created_at: review.date
    });
    if (error) throw error;
}

async function syncAdminReviews(reviews) {
    if (!marchicaSupabase || !marchicaAdmin) return;
    const remoteIds = new Set(reviews.map(review => review.id));
    for (const review of reviews) {
        const { error } = await marchicaSupabase.from('product_reviews').upsert({
            id: review.id,
            product_id: review.productId,
            customer_name: review.name,
            rating: review.rating,
            comment: review.comment,
            approved: review.approved,
            created_at: review.date
        });
        if (error) throw error;
    }
    const { data, error } = await marchicaSupabase.from('product_reviews').select('id');
    if (error) throw error;
    const removedIds = data.filter(row => !remoteIds.has(row.id)).map(row => row.id);
    if (removedIds.length) {
        const { error: deleteError } = await marchicaSupabase.from('product_reviews').delete().in('id', removedIds);
        if (deleteError) throw deleteError;
    }
}

async function loadOrdersFromSupabase() {
    const { data, error } = await marchicaSupabase.from('orders').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    storeRawValue(STORAGE_KEYS.ORDERS, data.map(row => ({
        orderId: row.order_id,
        customer: row.customer,
        products: row.products,
        subtotal: Number(row.subtotal),
        deliveryFee: Number(row.delivery_fee),
        total: Number(row.total),
        paymentMethod: row.payment_method,
        status: row.status,
        date: row.created_at,
        statusUpdatedAt: row.status_updated_at
    })));
}

function orderToSupabaseRow(order) {
    return {
        order_id: order.orderId,
        customer: order.customer,
        products: order.products,
        subtotal: order.subtotal,
        delivery_fee: order.deliveryFee,
        total: order.total,
        payment_method: order.paymentMethod,
        status: order.status,
        created_at: order.date,
        status_updated_at: order.statusUpdatedAt || null
    };
}

async function saveOrderToSupabase(order) {
    if (!marchicaBackendReady) return;
    const { data, error } = await marchicaSupabase.rpc('place_order', {
        p_order_id: order.orderId,
        p_customer: order.customer,
        p_products: order.products,
        p_payment_method: order.paymentMethod
    });
    if (error) throw error;
    return {
        orderId: data.order_id,
        customer: data.customer,
        products: data.products,
        subtotal: Number(data.subtotal),
        deliveryFee: Number(data.delivery_fee),
        total: Number(data.total),
        paymentMethod: data.payment_method,
        status: data.status,
        date: data.created_at
    };
}

async function syncOrderChanges(orders) {
    if (!marchicaSupabase || !marchicaAdmin) return;
    for (const order of orders) {
        const { error } = await marchicaSupabase.from('orders').upsert(orderToSupabaseRow(order));
        if (error) throw error;
    }
}

async function removeOrderFromSupabase(orderId) {
    if (!marchicaBackendReady || !marchicaAdmin) return;
    const { error } = await marchicaSupabase.from('orders').delete().eq('order_id', orderId);
    if (error) throw error;
}

async function trackOrderInSupabase(orderId, phone) {
    if (!marchicaBackendReady) return null;
    const { data, error } = await marchicaSupabase.rpc('track_order', {
        p_order_id: orderId,
        p_phone: phone
    });
    if (error) throw error;
    if (!data) return null;
    return {
        orderId: data.order_id,
        date: data.created_at,
        status: data.status,
        products: data.products,
        total: Number(data.total)
    };
}
