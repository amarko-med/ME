// ============================================================
// orders.js — Gestion des commandes
// ============================================================

function getOrders() {
    return getFromStorage(STORAGE_KEYS.ORDERS, []);
}

async function findOrderForCustomer(orderId, phone) {
    const normalizePhone = value => String(value || '').replace(/\D/g, '');
    const normalizedId = String(orderId || '').trim().toUpperCase();
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedId || !normalizedPhone) return null;
    if (supabaseIsConfigured() && !isSupabaseConnected()) {
        throw new Error('Le service de suivi est momentanément indisponible. Réessayez plus tard.');
    }
    if (isSupabaseConnected()) return trackOrderInSupabase(normalizedId, normalizedPhone);
    return getOrders().find(order =>
        order.orderId.toUpperCase() === normalizedId &&
        normalizePhone(order.customer.phone) === normalizedPhone
    ) || null;
}

function saveOrders(orders, remoteSaved = false) {
    saveToStorage(STORAGE_KEYS.ORDERS, orders);
    if (!remoteSaved && isSupabaseConnected()) {
        if (isSupabaseAdmin()) {
            syncOrderChanges(orders).catch(error => reportBackgroundError('synchronisation des commandes', error));
        } else if (orders.length) {
            saveOrderToSupabase(orders[orders.length - 1])
                .catch(error => reportBackgroundError('enregistrement de la commande', error));
        }
    }
    document.dispatchEvent(new CustomEvent('ordersUpdated'));
}

function generateOrderId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return `CMD-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

async function createOrder(customerInfo, paymentMethod = 'cod') {
    const cart = getCart();
    if (cart.length === 0) {
        showToast('Votre panier est vide', 'error');
        return null;
    }
    const products = getProducts();
    const unavailableItem = cart.find(item => {
        const product = products.find(p => p.id === item.productId);
        return !product || !isProductAvailable(product);
    });
    if (unavailableItem) {
        showToast('Un produit de votre panier n’est plus disponible', 'error');
        return null;
    }
    const items = cart.map(item => {
        const p = products.find(pr => pr.id === item.productId);
        return {
            productId: item.productId,
            name: p ? p.name : 'Produit inconnu',
            price: p ? p.price : 0,
            quantity: item.quantity,
            image: p ? p.image : ''
        };
    });
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const deliveryFee = subtotal >= 300 ? 0 : 30;
    const total = subtotal + deliveryFee;

    const order = {
        orderId: generateOrderId(),
        customer: {
            fullName: customerInfo.fullName,
            phone: customerInfo.phone,
            city: customerInfo.city,
            address: customerInfo.address,
            notes: customerInfo.notes || ''
        },
        products: items,
        subtotal,
        deliveryFee,
        total,
        paymentMethod: paymentMethod === 'whatsapp' ? 'WhatsApp' : 'Paiement à la livraison',
        status: 'Nouvelle',
        date: new Date().toISOString()
    };

    if (supabaseIsConfigured() && !isSupabaseConnected()) {
        throw new Error('Le service de commande est momentanément indisponible. Réessayez plus tard.');
    }
    if (isSupabaseConnected()) {
        const savedOrder = await saveOrderToSupabase(order);
        Object.assign(order, savedOrder);
    }
    const orders = getOrders();
    orders.push(order);
    saveOrders(orders, true);

    return order;
}

function updateOrderStatus(orderId, newStatus) {
    const orders = getOrders();
    const order = orders.find(o => o.orderId === orderId);
    if (order) {
        order.status = newStatus;
        order.statusUpdatedAt = new Date().toISOString();
        saveOrders(orders);
        showToast(`Commande ${orderId} mise à jour : ${newStatus}`, 'success');
    }
}

async function deleteOrder(orderId) {
    if (isSupabaseConnected() && isSupabaseAdmin()) {
        await removeOrderFromSupabase(orderId);
    }
    let orders = getOrders();
    orders = orders.filter(o => o.orderId !== orderId);
    saveOrders(orders);
    showToast(`Commande ${orderId} supprimée`, 'info');
}