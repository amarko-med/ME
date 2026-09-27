// ============================================================
// admin.js — Dashboard admin (démo) + upload d'images
// ============================================================

const ORDER_STATUSES = ['Nouvelle','Confirmée','En préparation','Expédiée','Livrée','Annulée'];

function isAdminLoggedIn() { return isSupabaseAdmin(); }
function adminLogin(email, password) { return supabaseAdminLogin(email, password); }
function adminLogout() { return supabaseAdminLogout(); }

// ============================================================
// HELPERS : conversion & compression d'images
// ============================================================

/**
 * Convertit un File image en data URL JPEG compressé.
 * @param {File} file
 * @param {number} maxWidth largeur max en pixels
 * @param {number} quality qualité JPEG (0-1)
 * @returns {Promise<string>}
 */
function fileToCompressedDataURL(file, maxWidth = 900, quality = 0.82) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('Fichier non-image'));
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    let { width, height } = img;
                    if (width > maxWidth) {
                        height = Math.round((maxWidth / width) * height);
                        width = maxWidth;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    // Fond blanc pour les PNG transparents
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, width, height);
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => reject(new Error('Image illisible'));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error('Lecture fichier échouée'));
        reader.readAsDataURL(file);
    });
}

function isDataUrl(s) { return typeof s === 'string' && s.startsWith('data:image'); }
function isHttpUrl(s) { return typeof s === 'string' && /^https?:\/\//i.test(s); }

// ============================================================
// LOGIN
// ============================================================
function renderAdminLogin() {
    return `
        <div class="admin-login">
            <h2><i class="fas fa-lock" style="color:var(--accent);"></i> Espace propriétaire</h2>
            <p class="demo-note"><i class="fas fa-info-circle"></i> ${supabaseIsConfigured()
                ? 'Connectez-vous avec le compte propriétaire créé dans Supabase.'
                : 'Ajoutez l’URL du projet et la clé anon dans js/supabase-config.js, puis publiez le site.'}</p>
            <div class="form-group"><label for="adminEmail">Adresse e-mail</label><input type="email" id="adminEmail" autocomplete="username" required></div>
            <div class="form-group"><label for="adminPassword">Mot de passe</label><input type="password" id="adminPassword" autocomplete="current-password" required></div>
            <button class="btn btn-primary" id="adminLoginBtn" style="width:100%">Se connecter</button>
        </div>
    `;
}

// ============================================================
// DASHBOARD
// ============================================================
function renderAdminDashboard() {
    return `
        <div style="margin:32px 0 48px;">
            <div class="flex-between" style="margin-bottom:24px;flex-wrap:wrap;gap:12px;">
                <h1 style="font-size:32px;font-weight:800;"><i class="fas fa-cog" style="color:var(--accent);"></i> Tableau de bord</h1>
                <button class="btn btn-outline" id="adminLogoutBtn"><i class="fas fa-sign-out-alt"></i> Déconnexion</button>
            </div>
            <div class="admin-nav" id="adminNav" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:32px;">
                <button class="active" data-admin-tab="dashboard">Tableau de bord</button>
                <button data-admin-tab="products">Produits</button>
                <button data-admin-tab="categories">Catégories</button>
                <button data-admin-tab="orders">Commandes</button>
                <button data-admin-tab="customers">Clients</button>
                <button data-admin-tab="promotions">Promotions</button>
                <button data-admin-tab="hero">Bannière</button>
                <button data-admin-tab="reviews">Avis clients</button>
                <button data-admin-tab="settings">Paramètres</button>
            </div>
            <div id="adminContent">${renderAdminTab('dashboard')}</div>
        </div>
    `;
}

function getAdminStats() {
    const orders = getOrders();
    const products = getProducts();
    const today = new Date().toDateString();
    const todayOrders = orders.filter(o => new Date(o.date).toDateString() === today);
    const todaySales = todayOrders.reduce((s, o) => s + o.total, 0);
    const customers = new Set(orders.map(o => o.customer.phone)).size;
    const availableProducts = products.filter(isProductAvailable).length;
    const bestSellers = products.filter(p => p.bestseller).slice(0, 5);
    return { todaySales, totalOrders: orders.length, customers, availableProducts, recentOrders: [...orders].reverse().slice(0, 5), bestSellers };
}

function statusClass(s) {
    return ({ 'Nouvelle':'new','Confirmée':'confirmed','En préparation':'prep','Expédiée':'shipped','Livrée':'delivered','Annulée':'cancelled' })[s] || 'new';
}

function renderAdminTab(tab) {
    const stats = getAdminStats();
    switch (tab) {
        case 'dashboard': return `
            <div class="stats-grid">
                <div class="stat-card"><h5>Ventes aujourd'hui</h5><div class="value">${stats.todaySales.toFixed(2)} DH</div></div>
                <div class="stat-card"><h5>Commandes totales</h5><div class="value">${stats.totalOrders}</div></div>
                <div class="stat-card"><h5>Clients</h5><div class="value">${stats.customers}</div></div>
                <div class="stat-card"><h5>Produits disponibles</h5><div class="value">${stats.availableProducts}</div></div>
            </div>
            <div class="admin-table-wrapper" style="margin-top:24px;">
                <h4 style="margin-bottom:16px;">Dernières commandes</h4>
                <table>
                    <thead><tr><th>N°</th><th>Client</th><th>Total</th><th>Statut</th><th></th></tr></thead>
                    <tbody>
                        ${stats.recentOrders.map(o => `<tr>
                            <td><strong>${o.orderId}</strong></td>
                            <td>${o.customer.fullName}</td>
                            <td>${o.total.toFixed(2)} DH</td>
                            <td><span class="status status-${statusClass(o.status)}">${o.status}</span></td>
                            <td><button class="icon-btn view-order" data-id="${o.orderId}"><i class="fas fa-eye"></i></button></td>
                        </tr>`).join('') || '<tr><td colspan="5">Aucune commande</td></tr>'}
                    </tbody>
                </table>
            </div>
            <div class="admin-table-wrapper" style="margin-top:24px;">
                <h4 style="margin-bottom:16px;">Meilleures ventes</h4>
                <table>
                    <thead><tr><th>Produit</th><th>Prix</th><th>Disponibilité</th></tr></thead>
                    <tbody>${stats.bestSellers.map(p => `<tr><td>${p.name}</td><td>${p.price} DH</td><td>${isProductAvailable(p) ? 'Disponible' : 'Indisponible'}</td></tr>`).join('') || '<tr><td colspan="3">Aucun</td></tr>'}</tbody>
                </table>
            </div>
        `;
        case 'products': return renderAdminProducts();
        case 'categories': return renderAdminCategories();
        case 'orders': return renderAdminOrders();
        case 'customers': return renderAdminCustomers();
        case 'promotions': return renderAdminPromotions();
        case 'hero': return renderAdminHero();
        case 'reviews': return renderAdminReviews();
        case 'settings': return renderAdminSettings();
        default: return '<p>Section en construction</p>';
    }
}

// ============================================================
// PRODUCTS LIST
// ============================================================
function renderAdminProducts() {
    const products = getProducts();
    return `
        <div class="admin-table-wrapper">
            <div class="flex-between" style="margin-bottom:16px;flex-wrap:wrap;gap:12px;">
                <h4>Liste des produits (${products.length})</h4>
                <button class="btn btn-primary" id="addProductBtn"><i class="fas fa-plus"></i> Ajouter un produit</button>
            </div>
            <table>
                <thead><tr><th>Image</th><th>Nom</th><th>Catégorie</th><th>Prix</th><th>Disponibilité</th><th>Actif</th><th>Actions</th></tr></thead>
                <tbody>
                    ${products.map(p => `<tr>
                        <td><img src="${p.image}" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:6px;"></td>
                        <td><strong>${p.name}</strong><br><small style="color:var(--text-secondary);">${p.sku || ''}</small></td>
                        <td>${getCategoryById(p.category)?.name || p.category}</td>
                        <td>${p.price} DH${p.oldPrice ? ` <small style="color:var(--text-secondary);text-decoration:line-through;">${p.oldPrice}</small>` : ''}</td>
                        <td><button class="availability-toggle ${isProductAvailable(p) ? 'is-available' : ''}" type="button" data-id="${p.id}" aria-pressed="${isProductAvailable(p)}" aria-label="${isProductAvailable(p) ? 'Rendre indisponible' : 'Rendre disponible'}"><span class="availability-switch"><span></span></span><span>${isProductAvailable(p) ? 'Disponible' : 'Indisponible'}</span></button></td>
                        <td>${p.active !== false ? '✅' : '❌'}</td>
                        <td style="white-space:nowrap;">
                            <button class="icon-btn edit-product" data-id="${p.id}" title="Modifier"><i class="fas fa-edit"></i></button>
                            <button class="icon-btn delete-product" data-id="${p.id}" title="Supprimer"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>`).join('') || '<tr><td colspan="7">Aucun produit</td></tr>'}
                </tbody>
            </table>
        </div>
    `;
}

// ============================================================
// CATEGORIES
// ============================================================
function renderAdminCategories() {
    const cats = getCategories();
    return `
        <div class="admin-table-wrapper">
            <div class="flex-between" style="margin-bottom:16px;flex-wrap:wrap;gap:12px;">
                <h4>Liste des catégories (${cats.length})</h4>
                <button class="btn btn-primary" id="addCategoryBtn"><i class="fas fa-plus"></i> Ajouter</button>
            </div>
            <table>
                <thead><tr><th>Icône</th><th>Nom</th><th>Description</th><th>Disponibilité</th><th>Actions</th></tr></thead>
                <tbody>${cats.map(c => `<tr>
                    <td><i class="fas ${c.icon}" style="font-size:20px;color:var(--accent);"></i></td>
                    <td>${c.name}</td>
                    <td><small>${c.description || ''}</small></td>
                    <td><button class="availability-toggle category-availability-toggle ${c.active !== false ? 'is-available' : ''}" type="button" data-id="${c.id}" aria-pressed="${c.active !== false}" aria-label="${c.active !== false ? 'Désactiver' : 'Activer'} la catégorie ${escapeHTML(c.name)}"><span class="availability-switch"><span></span></span><span>${c.active !== false ? 'Activée' : 'Désactivée'}</span></button></td>
                    <td style="white-space:nowrap;">
                        <button class="icon-btn edit-category" data-id="${c.id}"><i class="fas fa-edit"></i></button>
                        <button class="icon-btn delete-category" data-id="${c.id}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('') || '<tr><td colspan="5">Aucune catégorie</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

// ============================================================
// ORDERS
// ============================================================
function renderAdminOrders() {
    const orders = getOrders();
    return `
        <div class="admin-table-wrapper">
            <h4 style="margin-bottom:16px;">Commandes (${orders.length})</h4>
            <table>
                <thead><tr><th>N°</th><th>Client</th><th>Téléphone</th><th>Total</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>${orders.map(o => `<tr>
                    <td><strong>${o.orderId}</strong></td>
                    <td>${o.customer.fullName}</td>
                    <td>${o.customer.phone}</td>
                    <td>${o.total.toFixed(2)} DH</td>
                    <td>
                        <select class="order-status-select" data-order-id="${o.orderId}" style="padding:6px 10px;border-radius:20px;border:1px solid var(--border-light);background:var(--bg);color:var(--text-primary);font-size:13px;">
                            ${ORDER_STATUSES.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`).join('')}
                        </select>
                    </td>
                    <td>${new Date(o.date).toLocaleDateString('fr-FR')}</td>
                    <td style="white-space:nowrap;">
                        <button class="icon-btn view-order" data-id="${o.orderId}" title="Voir"><i class="fas fa-eye"></i></button>
                        <button class="icon-btn delete-order" data-id="${escapeHTML(o.orderId)}" title="Supprimer la commande" aria-label="Supprimer la commande ${escapeHTML(o.orderId)}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('') || '<tr><td colspan="7">Aucune commande</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

// ============================================================
// CUSTOMERS / PROMOTIONS / SETTINGS
// ============================================================
function renderAdminCustomers() {
    const orders = getOrders();
    const customers = {};
    orders.forEach(o => {
        const key = o.customer.phone;
        if (!customers[key]) customers[key] = { ...o.customer, orderCount: 0, totalSpent: 0 };
        customers[key].orderCount++;
        customers[key].totalSpent += o.total;
    });
    const list = Object.values(customers);
    return `
        <div class="admin-table-wrapper">
            <h4 style="margin-bottom:16px;">Clients (${list.length})</h4>
            <table>
                <thead><tr><th>Nom</th><th>Téléphone</th><th>Ville</th><th>Commandes</th><th>Total dépensé</th></tr></thead>
                <tbody>${list.map(c => `<tr>
                    <td>${c.fullName}</td><td>${c.phone}</td><td>${c.city}</td>
                    <td>${c.orderCount}</td><td>${c.totalSpent.toFixed(2)} DH</td>
                </tr>`).join('') || '<tr><td colspan="5">Aucun client</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function renderAdminPromotions() {
    const discounted = getProducts().filter(p => p.discount > 0);
    return `
        <div class="admin-table-wrapper">
            <h4 style="margin-bottom:16px;">Produits en promotion (${discounted.length})</h4>
            <table>
                <thead><tr><th>Produit</th><th>Prix</th><th>Ancien prix</th><th>Remise</th></tr></thead>
                <tbody>${discounted.map(p => `<tr><td>${p.name}</td><td>${p.price} DH</td><td>${p.oldPrice} DH</td><td><span class="discount-badge">-${p.discount}%</span></td></tr>`).join('') || '<tr><td colspan="4">Aucune promotion</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function renderAdminHero() {
    const slides = getHeroSlides();
    return `
        <div class="admin-table-wrapper">
            <div class="flex-between" style="margin-bottom:8px;flex-wrap:wrap;gap:12px;">
                <h4>Bannières d’accueil (${slides.length})</h4>
                <button class="btn btn-primary" id="addHeroSlide"><i class="fas fa-plus"></i> Ajouter une bannière</button>
            </div>
            <p style="color:var(--text-secondary);margin-bottom:16px;">Ajoutez, modifiez ou supprimez les diapositives affichées en haut de la page d’accueil.</p>
            <table>
                <thead><tr><th>#</th><th>Étiquette</th><th>Titre</th><th>Actions</th></tr></thead>
                <tbody>${slides.map((slide, index) => `<tr>
                    <td>${index + 1}</td>
                    <td>${escapeHTML(slide.tag)}</td>
                    <td>${escapeHTML(slide.title)}</td>
                    <td style="white-space:nowrap;">
                        <button class="btn btn-outline edit-hero-slide" data-index="${index}"><i class="fas fa-edit"></i> Modifier</button>
                        <button class="icon-btn delete-hero-slide" data-index="${index}" title="Supprimer la bannière ${index + 1}" aria-label="Supprimer la bannière ${index + 1}"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('')}</tbody>
            </table>
        </div>
    `;
}

function openHeroSlideModal(index) {
    const slides = getHeroSlides();
    const slide = slides[index];
    if (!slide) return;
    openModal(`
        <span class="close-modal"><i class="fas fa-times"></i></span>
        <h3>Modifier la diapositive ${index + 1}</h3>
        <div class="form-group"><label>Étiquette</label><input id="heroTag" value="${escapeHTML(slide.tag)}"></div>
        <div class="form-group"><label>Titre *</label><textarea id="heroTitle" rows="2">${escapeHTML(slide.title)}</textarea></div>
        <div class="form-group"><label>Description</label><textarea id="heroDescription" rows="3">${escapeHTML(slide.description)}</textarea></div>
        <div class="form-row">
            <div class="form-group"><label>Texte du bouton</label><input id="heroButtonText" value="${escapeHTML(slide.buttonText)}"></div>
            <div class="form-group"><label>Lien du bouton (#/... ou https://...)</label><input id="heroButtonLink" value="${escapeHTML(slide.buttonLink)}"></div>
        </div>
        <div class="form-group">
            <label>Image de la bannière</label>
            <div class="image-uploader-actions">
                <label class="btn btn-outline" style="cursor:pointer;display:inline-flex;">
                    <i class="fas fa-upload"></i> Téléverser une image
                    <input type="file" id="heroImageFile" accept="image/*" style="display:none;">
                </label>
                <button type="button" class="btn btn-outline" id="heroImageClear"><i class="fas fa-times"></i> Retirer</button>
            </div>
            <div class="url-divider"><span>ou coller une URL</span></div>
            <input type="text" id="heroImage" value="${escapeHTML(slide.image.startsWith('data:') ? '' : slide.image)}" placeholder="https://...">
            <small class="upload-hint" id="heroImageHint">${slide.image.startsWith('data:') ? '✅ Image téléversée' : ''}</small>
        </div>
        <div class="hero-preview-wrap">
            <h4>Aperçu de la bannière</h4>
            <div class="hero-slider hero-preview-slider" id="heroLivePreview"></div>
        </div>
        <div class="modal-actions">
            <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
            <button class="btn btn-primary" id="saveHeroSlideBtn">Enregistrer</button>
        </div>
    `);

    let imageData = slide.image;
    const preview = document.getElementById('heroLivePreview');
    const renderPreview = () => {
        const tag = document.getElementById('heroTag').value.trim();
        const title = document.getElementById('heroTitle').value.trim() || 'Titre de la bannière';
        const description = document.getElementById('heroDescription').value.trim();
        const buttonText = document.getElementById('heroButtonText').value.trim();
        const buttonLink = document.getElementById('heroButtonLink').value.trim();
        const safeLink = buttonLink.startsWith('#/') || /^https?:\/\//i.test(buttonLink) ? buttonLink : '#/';
        preview.innerHTML = `
            <div class="hero-content">
                ${tag ? `<span class="tag">${escapeHTML(tag)}</span>` : ''}
                <h1>${escapeHTML(title)}</h1>
                ${description ? `<p>${escapeHTML(description)}</p>` : ''}
                ${buttonText ? `<a class="btn btn-primary" href="${escapeHTML(safeLink)}">${escapeHTML(buttonText)} <i class="fas fa-arrow-right"></i></a>` : ''}
            </div>
            <div class="hero-image">${imageData ? `<img src="${escapeHTML(imageData)}" alt="${escapeHTML(title)}">` : '<div class="hero-preview-empty">Aucune image sélectionnée</div>'}</div>
        `;
    };
    ['heroTag', 'heroTitle', 'heroDescription', 'heroButtonText', 'heroButtonLink'].forEach(id => {
        document.getElementById(id).addEventListener('input', renderPreview);
    });
    document.getElementById('heroImage').addEventListener('input', event => {
        imageData = event.target.value.trim();
        document.getElementById('heroImageHint').textContent = '';
        renderPreview();
    });
    document.getElementById('heroImageFile').addEventListener('change', async event => {
        const file = event.target.files[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) {
            showToast('Image trop lourde (max 8 Mo)', 'error');
            event.target.value = '';
            return;
        }
        try {
            showToast('Compression de l’image…', 'info');
            imageData = await fileToCompressedDataURL(file, 1000, 0.76);
            document.getElementById('heroImage').value = '';
            document.getElementById('heroImageHint').textContent = '✅ Image téléversée';
            renderPreview();
            showToast('Image téléversée', 'success');
        } catch (error) {
            console.error('Erreur téléversement image de la bannière', error);
            showToast('Impossible de charger l’image', 'error');
        }
        event.target.value = '';
    });
    document.getElementById('heroImageClear').addEventListener('click', () => {
        imageData = '';
        document.getElementById('heroImage').value = '';
        document.getElementById('heroImageHint').textContent = '';
        renderPreview();
    });
    renderPreview();

    document.getElementById('saveHeroSlideBtn').addEventListener('click', () => {
        const title = document.getElementById('heroTitle').value.trim();
        const buttonLink = document.getElementById('heroButtonLink').value.trim();
        const image = imageData;
        if (!title) {
            showToast('Le titre est requis', 'error');
            return;
        }
        if (!buttonLink.startsWith('#/') && !/^https?:\/\//i.test(buttonLink)) {
            showToast('Le lien doit commencer par #/ ou https://', 'error');
            return;
        }
        if (image && !image.startsWith('data:image/') && !/^https?:\/\//i.test(image)) {
            showToast('L’image doit être téléversée ou utiliser une URL https:// valide', 'error');
            return;
        }
        slides[index] = {
            tag: document.getElementById('heroTag').value.trim(),
            title,
            description: document.getElementById('heroDescription').value.trim(),
            buttonText: document.getElementById('heroButtonText').value.trim(),
            buttonLink,
            image
        };
        if (!saveHeroSlides(slides)) {
            showToast('Impossible d’enregistrer : espace de stockage insuffisant. Choisissez une image plus petite.', 'error');
            return;
        }
        closeModal();
        document.getElementById('adminContent').innerHTML = renderAdminHero();
        attachAdminTabEvents('hero');
        showToast('Diapositive enregistrée', 'success');
    });
}

function renderAdminReviews() {
    const reviews = [...getProductReviews()].reverse();
    return `
        <div class="admin-table-wrapper">
            <h4 style="margin-bottom:16px;">Avis clients (${reviews.length})</h4>
            <p style="color:var(--text-secondary);margin-bottom:16px;">Les avis doivent être approuvés avant leur affichage public.</p>
            <table>
                <thead><tr><th>Produit</th><th>Client</th><th>Note</th><th>Avis</th><th>État</th><th>Actions</th></tr></thead>
                <tbody>${reviews.map(review => `<tr>
                    <td>${escapeHTML(getProductById(review.productId)?.name || 'Produit supprimé')}</td>
                    <td>${escapeHTML(review.name)}</td>
                    <td>${review.rating}/5</td>
                    <td>${escapeHTML(review.comment)}</td>
                    <td>${review.approved ? 'Publié' : 'En attente'}</td>
                    <td style="white-space:nowrap;">
                        ${review.approved ? '' : `<button class="icon-btn approve-review" data-id="${escapeHTML(review.id)}" title="Approuver"><i class="fas fa-check"></i></button>`}
                        <button class="icon-btn delete-review" data-id="${escapeHTML(review.id)}" title="Supprimer"><i class="fas fa-trash"></i></button>
                    </td>
                </tr>`).join('') || '<tr><td colspan="6">Aucun avis pour le moment</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function renderAdminSettings() {
    const settings = getShopSettings();
    return `<div class="admin-table-wrapper admin-store-settings">
        <h4>Coordonnées et informations du magasin</h4>
        <p style="color:var(--text-secondary);margin:8px 0 20px;">Ces informations apparaissent sur la page Contact et servent aux notifications de commande sur WhatsApp.</p>
        <div class="form-group"><label>Téléphone / WhatsApp (format international)</label><input id="shopPhone" type="tel" value="${escapeHTML(settings.phone)}" placeholder="2126XXXXXXXX"></div>
        <div class="form-group"><label>Adresse</label><input id="shopAddress" value="${escapeHTML(settings.address)}"></div>
        <div class="form-group"><label>Horaires d’ouverture</label><textarea id="shopHours" rows="3">${escapeHTML(settings.openingHours)}</textarea></div>
        <div class="form-group"><label>Livraison</label><textarea id="shopDelivery" rows="3">${escapeHTML(settings.deliveryInfo)}</textarea></div>
        <div class="form-group"><label>Retours et échanges</label><textarea id="shopReturns" rows="3">${escapeHTML(settings.returnsInfo)}</textarea></div>
        <h4 class="admin-settings-subheading">Réseaux sociaux</h4>
        <p class="admin-settings-help">Ajoutez les liens HTTPS de vos profils. Les icônes sans lien ne seront pas affichées.</p>
        <div class="social-settings-grid">
            <div class="form-group"><label for="shopFacebook">Facebook</label><input id="shopFacebook" type="url" value="${escapeHTML(settings.socialLinks.facebook)}" placeholder="https://facebook.com/votre-page"></div>
            <div class="form-group"><label for="shopInstagram">Instagram</label><input id="shopInstagram" type="url" value="${escapeHTML(settings.socialLinks.instagram)}" placeholder="https://instagram.com/votre-compte"></div>
            <div class="form-group"><label for="shopTikTok">TikTok</label><input id="shopTikTok" type="url" value="${escapeHTML(settings.socialLinks.tiktok)}" placeholder="https://tiktok.com/@votre-compte"></div>
            <div class="form-group"><label for="shopYouTube">YouTube</label><input id="shopYouTube" type="url" value="${escapeHTML(settings.socialLinks.youtube)}" placeholder="https://youtube.com/@votre-chaine"></div>
            <div class="form-group"><label for="shopLinkedIn">LinkedIn</label><input id="shopLinkedIn" type="url" value="${escapeHTML(settings.socialLinks.linkedin)}" placeholder="https://linkedin.com/company/votre-page"></div>
        </div>
        <button class="btn btn-primary" id="saveShopSettings"><i class="fas fa-save"></i> Enregistrer les informations</button>
        <p style="margin-top:20px;color:var(--text-secondary);font-size:13px;">${isSupabaseConnected()
            ? 'Les produits, commandes, avis et paramètres sont synchronisés avec Supabase.'
            : 'Supabase n’est pas connecté : les modifications restent enregistrées dans ce navigateur.'}</p>
    </div>`;
}

// ============================================================
// PRODUCT MODAL (avec upload d'images)
// ============================================================
function openProductModal(productId = null) {
    const isEdit = !!productId;
    const p = isEdit ? getProductById(productId) : null;
    const cats = getActiveCategories();
    const specsText = p && p.specs ? Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join('\n') : '';

    // --- État local pour les images (data URL ou URL http) ---
    let mainImageData = p?.image || '';
    let additionalImagesData = Array.isArray(p?.additionalImages) ? [...p.additionalImages] : [];

    const mainImageIsUpload = isDataUrl(mainImageData);
    const mainImageIsUrl = isHttpUrl(mainImageData);

    openModal(`
        <span class="close-modal"><i class="fas fa-times"></i></span>
        <h3>${isEdit ? 'Modifier le produit' : 'Nouveau produit'}</h3>

        <div class="form-row">
            <div class="form-group"><label>Nom *</label><input id="pName" value="${p?.name || ''}"></div>
            <div class="form-group"><label>SKU</label><input id="pSku" value="${p?.sku || ''}"></div>
        </div>

        <div class="form-row">
            <div class="form-group"><label>Catégorie *</label>
                <select id="pCategory">${cats.map(c => `<option value="${c.id}" ${p?.category === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
            </div>
            <div class="form-group"><label>Sous-catégorie</label><input id="pSubcategory" value="${p?.subcategory || ''}"></div>
        </div>

        <div class="form-row">
            <div class="form-group"><label>Prix (DH) *</label><input type="number" id="pPrice" value="${p?.price || ''}" min="0" step="0.01"></div>
            <div class="form-group"><label>Ancien prix (DH)</label><input type="number" id="pOldPrice" value="${p?.oldPrice || ''}" min="0" step="0.01"></div>
        </div>

        <div class="form-row">
            <div class="form-group">
                <label>Disponibilité</label>
                <label class="availability-control">
                    <input type="checkbox" id="pAvailable" ${!p || isProductAvailable(p) ? 'checked' : ''}>
                    <span class="availability-switch"><span></span></span>
                    <span class="availability-label">${!p || isProductAvailable(p) ? 'Disponible' : 'Indisponible'}</span>
                </label>
            </div>
            <div class="form-group"><label>Remise (%) — auto-calculée</label><input type="number" id="pDiscount" value="${p?.discount || 0}" min="0" max="100"></div>
        </div>

        <div class="form-group"><label>Description</label><textarea id="pDescription" rows="3">${p?.description || ''}</textarea></div>

        <!-- ========= IMAGE PRINCIPALE ========= -->
        <div class="form-group">
            <label>Image principale</label>
            <div class="image-uploader">
                <div class="image-preview" id="mainImagePreview">
                    ${mainImageData ? `<img src="${mainImageData}" alt="">` : `<div class="image-placeholder"><i class="fas fa-image"></i><span>Aucune image</span></div>`}
                </div>
                <div class="image-uploader-actions">
                    <label class="btn btn-outline" style="cursor:pointer;display:inline-flex;">
                        <i class="fas fa-upload"></i> Téléverser un fichier
                        <input type="file" id="mainImageFile" accept="image/*" style="display:none;">
                    </label>
                    <button type="button" class="btn btn-outline" id="mainImageClearBtn">
                        <i class="fas fa-times"></i> Retirer
                    </button>
                </div>
                <div class="url-divider"><span>ou coller une URL</span></div>
                <input type="text" id="pImage" value="${mainImageIsUrl ? mainImageData : ''}" placeholder="https://...">
                <small class="upload-hint" id="mainImageHint">${mainImageIsUpload ? '✅ Image téléversée' : ''}</small>
            </div>
        </div>

        <!-- ========= IMAGES SUPPLÉMENTAIRES ========= -->
        <div class="form-group">
            <label>Images supplémentaires (galerie)</label>
            <div class="image-uploader">
                <div class="gallery-previews" id="galleryPreviews"></div>
                <div class="image-uploader-actions">
                    <label class="btn btn-outline" style="cursor:pointer;display:inline-flex;">
                        <i class="fas fa-images"></i> Ajouter des images
                        <input type="file" id="additionalImagesFile" accept="image/*" multiple style="display:none;">
                    </label>
                </div>
                <div class="url-divider"><span>ou URLs (une par ligne)</span></div>
                <textarea id="pAdditionalImages" rows="2" placeholder="https://...&#10;https://...">${additionalImagesData.filter(isHttpUrl).join('\n')}</textarea>
            </div>
        </div>

        <div class="form-group"><label>Spécifications (une par ligne, format <code>Clé: Valeur</code>)</label>
            <textarea id="pSpecs" rows="3" placeholder="Couleur: Noir&#10;Poids: 250 g">${specsText}</textarea>
        </div>

        <div class="form-row">
            <div class="form-group"><label>Note (0-5)</label><input type="number" id="pRating" value="${p?.rating || 0}" min="0" max="5" step="0.1"></div>
            <div class="form-group"><label>Nombre d'avis</label><input type="number" id="pReviewCount" value="${p?.reviewCount || 0}" min="0"></div>
        </div>

        <div class="form-row">
            <div class="form-group"><label>Meilleure vente</label><select id="pBestseller"><option value="false" ${!p?.bestseller ? 'selected' : ''}>Non</option><option value="true" ${p?.bestseller ? 'selected' : ''}>Oui</option></select></div>
            <div class="form-group"><label>Nouveauté</label><select id="pNew"><option value="false" ${!p?.newProduct ? 'selected' : ''}>Non</option><option value="true" ${p?.newProduct ? 'selected' : ''}>Oui</option></select></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Recommandé</label><select id="pFeatured"><option value="false" ${!p?.featured ? 'selected' : ''}>Non</option><option value="true" ${p?.featured ? 'selected' : ''}>Oui</option></select></div>
            <div class="form-group"><label>Actif</label><select id="pActive"><option value="true" ${p?.active !== false ? 'selected' : ''}>Oui</option><option value="false" ${p?.active === false ? 'selected' : ''}>Non</option></select></div>
        </div>

        <div class="modal-actions">
            <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
            <button class="btn btn-primary" id="saveProductBtn">Enregistrer</button>
        </div>
    `);

    document.getElementById('pAvailable').addEventListener('change', (event) => {
        document.querySelector('.availability-label').textContent = event.target.checked ? 'Disponible' : 'Indisponible';
    });

    // -------- Preview helpers --------
    const mainPreview = document.getElementById('mainImagePreview');
    const mainHint = document.getElementById('mainImageHint');

    function renderMainPreview() {
        if (!mainImageData) {
            mainPreview.innerHTML = `<div class="image-placeholder"><i class="fas fa-image"></i><span>Aucune image</span></div>`;
        } else {
            mainPreview.innerHTML = `<img src="${mainImageData}" alt="">`;
        }
        mainHint.textContent = isDataUrl(mainImageData) ? '✅ Image téléversée' : (mainImageData ? '🔗 URL externe' : '');
    }

    function renderGalleryPreviews() {
        const container = document.getElementById('galleryPreviews');
        if (additionalImagesData.length === 0) {
            container.innerHTML = `<div class="image-placeholder" style="height:80px;font-size:12px;"><i class="fas fa-images"></i><span>Aucune image supplémentaire</span></div>`;
            return;
        }
        container.innerHTML = additionalImagesData.map((src, i) => `
            <div class="gallery-thumb">
                <img src="${src}" alt="">
                <button type="button" class="gallery-thumb-remove" data-index="${i}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');
        container.querySelectorAll('.gallery-thumb-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                additionalImagesData.splice(parseInt(btn.dataset.index), 1);
                renderGalleryPreviews();
            });
        });
    }

    renderMainPreview();
    renderGalleryPreviews();

    // -------- Upload image principale --------
    document.getElementById('mainImageFile').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) { showToast('Image trop lourde (max 8 Mo)', 'error'); return; }
        try {
            showToast('Compression de l\'image…', 'info');
            mainImageData = await fileToCompressedDataURL(file, 900, 0.82);
            // On vide le champ URL puisqu'on utilise l'upload
            document.getElementById('pImage').value = '';
            renderMainPreview();
            showToast('Image téléversée', 'success');
        } catch (err) {
            showToast('Impossible de charger l\'image', 'error');
        }
        e.target.value = ''; // reset input
    });

    // -------- URL input --------
    document.getElementById('pImage').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        if (val) { mainImageData = val; renderMainPreview(); }
    });

    // -------- Retirer image principale --------
    document.getElementById('mainImageClearBtn').addEventListener('click', () => {
        mainImageData = '';
        document.getElementById('pImage').value = '';
        renderMainPreview();
    });

    // -------- Upload images supplémentaires (multiple) --------
    document.getElementById('additionalImagesFile').addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        if (additionalImagesData.length + files.length > 6) {
            showToast('Maximum 6 images supplémentaires', 'error');
            return;
        }
        showToast(`Compression de ${files.length} image(s)…`, 'info');
        for (const file of files) {
            if (file.size > 8 * 1024 * 1024) { showToast(`${file.name} trop lourde, ignorée`, 'error'); continue; }
            try {
                const dataUrl = await fileToCompressedDataURL(file, 900, 0.82);
                additionalImagesData.push(dataUrl);
            } catch (err) {
                console.warn('Échec upload', file.name, err);
            }
        }
        renderGalleryPreviews();
        // On garde aussi les URLs saisies dans le textarea
        syncAdditionalUrlsToState();
        showToast('Images ajoutées', 'success');
        e.target.value = '';
    });

    // -------- Textarea URLs additionnelles --------
    const addImgTextarea = document.getElementById('pAdditionalImages');
    addImgTextarea.addEventListener('input', syncAdditionalUrlsToState);

    function syncAdditionalUrlsToState() {
        // On conserve les data URLs déjà en mémoire, et on remplace les URLs http par la saisie
        const uploaded = additionalImagesData.filter(isDataUrl);
        const urls = addImgTextarea.value.split('\n').map(s => s.trim()).filter(isHttpUrl);
        additionalImagesData = [...uploaded, ...urls];
    }

    // -------- Auto-calcul remise --------
    const priceEl = document.getElementById('pPrice');
    const oldPriceEl = document.getElementById('pOldPrice');
    const discountEl = document.getElementById('pDiscount');
    const recalc = () => {
        const price = parseFloat(priceEl.value) || 0;
        const oldPrice = parseFloat(oldPriceEl.value) || 0;
        if (oldPrice > price && oldPrice > 0) {
            discountEl.value = Math.round(((oldPrice - price) / oldPrice) * 100);
        }
    };
    priceEl.addEventListener('input', recalc);
    oldPriceEl.addEventListener('input', recalc);

    // -------- Sauvegarde --------
    document.getElementById('saveProductBtn').addEventListener('click', () => {
        const name = document.getElementById('pName').value.trim();
        const price = parseFloat(priceEl.value);
        if (!name) { showToast('Le nom est requis', 'error'); return; }
        if (!price || price <= 0) { showToast('Le prix doit être positif', 'error'); return; }
        if (!mainImageData) { showToast('Ajoutez une image principale', 'error'); return; }

        // Fusionner URLs du textarea avant de sauvegarder
        syncAdditionalUrlsToState();

        // Parse specs
        const specsRaw = document.getElementById('pSpecs').value.trim();
        const specs = {};
        if (specsRaw) specsRaw.split('\n').forEach(line => {
            const i = line.indexOf(':');
            if (i > 0) specs[line.slice(0, i).trim()] = line.slice(i + 1).trim();
        });

        const formData = {
            name,
            sku: document.getElementById('pSku').value.trim(),
            category: document.getElementById('pCategory').value,
            subcategory: document.getElementById('pSubcategory').value.trim(),
            price,
            oldPrice: parseFloat(oldPriceEl.value) || null,
            discount: parseInt(discountEl.value) || 0,
            available: document.getElementById('pAvailable').checked,
            description: document.getElementById('pDescription').value,
            image: mainImageData,
            additionalImages: additionalImagesData.filter(Boolean),
            specs,
            rating: parseFloat(document.getElementById('pRating').value) || 0,
            reviewCount: parseInt(document.getElementById('pReviewCount').value) || 0,
            bestseller: document.getElementById('pBestseller').value === 'true',
            newProduct: document.getElementById('pNew').value === 'true',
            featured: document.getElementById('pFeatured').value === 'true',
            active: document.getElementById('pActive').value === 'true'
        };

        const prods = getProducts();
        if (isEdit) {
            const idx = prods.findIndex(pr => pr.id === productId);
            if (idx !== -1) prods[idx] = { ...prods[idx], ...formData };
        } else {
            prods.push({ id: 'p' + Date.now(), ...formData });
        }

        try {
            setProducts(prods);
        } catch (err) {
            showToast('Stockage plein — essayez des images plus petites', 'error');
            return;
        }

        closeModal();
        document.getElementById('adminContent').innerHTML = renderAdminProducts();
        attachAdminTabEvents('products');
        showToast('Produit enregistré', 'success');
    });
}

// ============================================================
// CATEGORY MODAL
// ============================================================
function openCategoryModal(catId = null) {
    const isEdit = !!catId;
    const c = isEdit ? getCategoryById(catId) : null;
    openModal(`
        <span class="close-modal"><i class="fas fa-times"></i></span>
        <h3>${isEdit ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h3>
        <div class="form-group"><label>Nom *</label><input id="cName" value="${c?.name || ''}"></div>
        <div class="form-group"><label>Icône (classe Font Awesome)</label><input id="cIcon" value="${c?.icon || 'fa-tag'}" placeholder="fa-tag"></div>
        <div class="form-group"><label>Description</label><input id="cDescription" value="${c?.description || ''}"></div>
        <div class="form-group"><label>Active</label><select id="cActive"><option value="true" ${c?.active !== false ? 'selected' : ''}>Oui</option><option value="false" ${c?.active === false ? 'selected' : ''}>Non</option></select></div>
        <div class="modal-actions">
            <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
            <button class="btn btn-primary" id="saveCategoryBtn">Enregistrer</button>
        </div>
    `);
    document.getElementById('saveCategoryBtn').addEventListener('click', () => {
        const name = document.getElementById('cName').value.trim();
        if (!name) { showToast('Le nom est requis', 'error'); return; }
        const cats = getCategories();
        const data = {
            name,
            icon: document.getElementById('cIcon').value.trim() || 'fa-tag',
            description: document.getElementById('cDescription').value.trim(),
            active: document.getElementById('cActive').value === 'true'
        };
        if (isEdit) {
            const idx = cats.findIndex(cc => cc.id === catId);
            if (idx !== -1) cats[idx] = { ...cats[idx], ...data };
        } else {
            cats.push({ id: 'cat' + Date.now(), ...data });
        }
        setCategories(cats);
        closeModal();
        document.getElementById('adminContent').innerHTML = renderAdminCategories();
        attachAdminTabEvents('categories');
        showToast('Catégorie enregistrée', 'success');
    });
}

// ============================================================
// ORDER DETAIL MODAL
// ============================================================
function openOrderModal(orderId) {
    const order = getOrders().find(o => o.orderId === orderId);
    if (!order) return;
    openModal(`
        <span class="close-modal"><i class="fas fa-times"></i></span>
        <h3>Commande ${order.orderId}</h3>
        <div style="background:var(--bg);border:1px solid var(--border-light);border-radius:8px;padding:16px;margin-bottom:16px;">
            <h4 style="margin-bottom:8px;font-size:14px;color:var(--text-secondary);">CLIENT</h4>
            <p><strong>${order.customer.fullName}</strong></p>
            <p>📞 ${order.customer.phone}</p>
            <p>📍 ${order.customer.city} — ${order.customer.address}</p>
            ${order.customer.notes ? `<p>📝 ${order.customer.notes}</p>` : ''}
        </div>

        <div style="background:var(--bg);border:1px solid var(--border-light);border-radius:8px;padding:16px;margin-bottom:16px;">
            <h4 style="margin-bottom:8px;font-size:14px;color:var(--text-secondary);">PRODUITS</h4>
            <table style="font-size:14px;">
                <tbody>${order.products.map(i => `<tr>
                    <td><img src="${i.image}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;vertical-align:middle;margin-right:8px;"> ${i.name}</td>
                    <td style="text-align:right;">× ${i.quantity}</td>
                    <td style="text-align:right;padding-left:16px;">${(i.price * i.quantity).toFixed(2)} DH</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>

        <div style="background:var(--bg);border:1px solid var(--border-light);border-radius:8px;padding:16px;margin-bottom:16px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Sous-total</span><span>${order.subtotal.toFixed(2)} DH</span></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:6px;"><span>Livraison</span><span>${order.deliveryFee === 0 ? 'Gratuite' : order.deliveryFee.toFixed(2) + ' DH'}</span></div>
            <div style="display:flex;justify-content:space-between;font-weight:800;font-size:18px;border-top:1px solid var(--border-light);padding-top:8px;margin-top:8px;"><span>Total</span><span>${order.total.toFixed(2)} DH</span></div>
        </div>

        <div class="form-group">
            <label>Statut de la commande</label>
            <select id="modalOrderStatus" style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border-light);background:var(--bg);color:var(--text-primary);">
                ${ORDER_STATUSES.map(s => `<option value="${s}" ${order.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
        </div>

        <p style="font-size:13px;color:var(--text-secondary);">
            Paiement : <strong>${order.paymentMethod}</strong><br>
            Date : ${new Date(order.date).toLocaleString('fr-FR')}
        </p>

        <div class="modal-actions">
            <button class="btn btn-outline" id="deleteOrderModalBtn" style="color:var(--accent);border-color:var(--accent);">
                <i class="fas fa-trash"></i> Supprimer
            </button>
            <button class="btn btn-primary" id="saveOrderModalBtn">Enregistrer le statut</button>
        </div>
    `);
    document.getElementById('saveOrderModalBtn').addEventListener('click', () => {
        const newStatus = document.getElementById('modalOrderStatus').value;
        updateOrderStatus(order.orderId, newStatus);
        closeModal();
        document.getElementById('adminContent').innerHTML = renderAdminTab('orders');
        attachAdminTabEvents('orders');
    });
    document.getElementById('deleteOrderModalBtn').addEventListener('click', async () => {
        if (confirm(`Supprimer la commande ${order.orderId} ?`)) {
            const button = document.getElementById('deleteOrderModalBtn');
            button.disabled = true;
            try {
                await deleteOrder(order.orderId);
                closeModal();
                document.getElementById('adminContent').innerHTML = renderAdminTab('orders');
                attachAdminTabEvents('orders');
            } catch (error) {
                button.disabled = false;
                showToast(`Impossible de supprimer la commande : ${backendErrorMessage(error)}`, 'error');
            }
        }
    });
}