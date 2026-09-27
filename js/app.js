// ============================================================
// app.js — Routage, rendu et interactions
// ============================================================

// ---------- STATE ----------
let _listingBaseProducts = [];
let currentFilters = {};
let _heroInterval = null;

function updateSocialLinks() {
    const settings = getShopSettings();
    const whatsappUrl = `https://wa.me/${getShopWhatsAppNumber()}`;
    const topWhatsapp = document.getElementById('topWhatsapp');
    if (topWhatsapp) {
        topWhatsapp.href = whatsappUrl;
        topWhatsapp.target = '_blank';
        topWhatsapp.rel = 'noopener noreferrer';
    }
    document.querySelectorAll('[data-social-link]').forEach(link => {
        const platform = link.dataset.socialLink;
        const url = platform === 'whatsapp' ? whatsappUrl : settings.socialLinks[platform];
        link.hidden = !url;
        if (url) {
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        } else {
            link.removeAttribute('href');
            link.removeAttribute('target');
            link.removeAttribute('rel');
        }
    });
}

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', async () => {
    initProductsAndCategories();
    initTheme();
    try {
        await initializeSupabaseBackend();
    } catch (error) {
        notifyBackendError('connexion', error);
    }

    initRouter();
    initEventListeners();
    updateCartBadge();
    updateFavBadge();
    renderFooterCategories();
    handleRoute();
});

// ---------- THEME ----------
function initTheme() {
    const theme = getFromStorage(STORAGE_KEYS.THEME, 'light');
    const body = document.body;
    const icon = document.querySelector('#themeToggle i');
    if (theme === 'dark') {
        body.classList.add('dark');
        icon?.classList.replace('fa-moon', 'fa-sun');
    }
}

// ---------- ROUTER ----------
function initRouter() {
    window.addEventListener('hashchange', handleRoute);
    document.body.addEventListener('click', (e) => {
        const link = e.target.closest('[data-route]');
        if (link) {
            e.preventDefault();
            window.location.hash = link.dataset.route;
            document.getElementById('mainNav')?.classList.remove('open');
        }
    });
}

function handleRoute() {
    const hash = window.location.hash || '#/';
    const app = document.getElementById('app');
    if (!app) return;
    if (_heroInterval) {
        clearInterval(_heroInterval);
        _heroInterval = null;
    }
    app.innerHTML = '';

    if (hash.startsWith('#/produit/')) {
        renderProductDetail(hash.split('/')[2]);
    } else if (hash.startsWith('#/categorie/')) {
        const catId = hash.split('/')[2];
        const cat = getCategoryById(catId);
        if (!cat) return renderHomePage();
        renderListingPage(
            getActiveProducts().filter(p => p.category === catId),
            cat.name,
            cat.description || 'Découvrez notre sélection',
            { category: catId }
        );
    } else if (hash.startsWith('#/recherche')) {
        const q = new URLSearchParams(hash.split('?')[1]).get('q') || '';
        renderListingPage(
            getActiveProducts(),
            `Résultats pour « ${q} »`,
            'Affinez votre recherche avec les filtres',
            { search: q }
        );
    } else if (hash === '#/panier') {
        renderCartPage();
    } else if (hash === '#/favoris') {
        renderFavoritesPage();
    } else if (hash === '#/checkout') {
        renderCheckoutPage();
    } else if (hash.startsWith('#/suivi')) {
        renderOrderTrackingPage();
    } else if (hash === '#/contact') {
        renderContactPage();
    } else if (hash === '#/categories') {
        renderAllCategoriesPage();
    } else if (hash === '#/nouveautes') {
        renderListingPage(getActiveProducts().filter(p => p.newProduct), 'Nouveautés', 'Les derniers produits ajoutés');
    } else if (hash === '#/meilleures-ventes') {
        renderListingPage(getActiveProducts().filter(p => p.bestseller), 'Meilleures ventes', 'Les produits les plus appréciés');
    } else if (hash === '#/promotions') {
        renderListingPage(getActiveProducts().filter(p => p.discount > 0), 'Promotions', 'Profitez de nos meilleures offres', { discountOnly: true });
    } else if (hash === '#/admin') {
        if (isAdminLoggedIn()) {
            app.innerHTML = renderAdminDashboard();
            initAdminEvents();
        } else {
            app.innerHTML = renderAdminLogin();
            initAdminLoginEvents();
        }
    } else {
        renderHomePage();
    }
    window.scrollTo(0, 0);
}

// ---------- LISTING PAGE (filtres + tri) ----------
function renderListingPage(baseProducts, title, subtitle, presetFilters = {}) {
    _listingBaseProducts = baseProducts;
    currentFilters = {
        minPrice: 0,
        maxPrice: 20000,
        availability: 'all',
        minRating: 0,
        discountOnly: false,
        sort: 'pertinence',
        ...presetFilters
    };

    const app = document.getElementById('app');
    app.innerHTML = `
        <div style="margin:32px 0;">
            <div class="section-header">
                <div>
                    <h1 class="section-title">${title}</h1>
                    <p class="section-sub">${subtitle}</p>
                </div>
            </div>
            <div class="listing-layout">
                <aside class="filters-panel" id="filtersPanel">${renderFiltersHTML()}</aside>
                <div class="listing-content">
                    <div class="listing-toolbar">
                        <span id="resultCount" style="color:var(--text-secondary);font-size:14px;"></span>
                        <select id="sortSelect" class="sort-select" style="padding:8px 14px;border-radius:50px;border:1px solid var(--border-light);background:var(--surface);color:var(--text-primary);font-size:14px;">
                            <option value="pertinence">Pertinence</option>
                            <option value="prix-asc">Prix croissant</option>
                            <option value="prix-desc">Prix décroissant</option>
                            <option value="nouveautes">Nouveautés</option>
                            <option value="meilleures-ventes">Meilleures ventes</option>
                        </select>
                    </div>
                    <div class="product-carousel" id="productGrid"></div>
                </div>
            </div>
        </div>
    `;
    attachFilterEvents();
    refreshGrid();
}

function renderFiltersHTML() {
    return `
        <h3 class="filter-title"><i class="fas fa-sliders-h"></i> Filtres</h3>
        <div class="filter-group">
            <label>Prix (DH)</label>
            <div class="price-inputs">
                <input type="number" id="filterMinPrice" placeholder="Min" value="${currentFilters.minPrice || ''}" min="0">
                <span>—</span>
                <input type="number" id="filterMaxPrice" placeholder="Max" value="${currentFilters.maxPrice && currentFilters.maxPrice < 20000 ? currentFilters.maxPrice : ''}" min="0">
            </div>
        </div>
        <div class="filter-group">
            <label>Disponibilité</label>
            <select id="filterAvailability">
                <option value="all" ${currentFilters.availability === 'all' ? 'selected' : ''}>Tous les produits</option>
                <option value="in" ${currentFilters.availability === 'in' ? 'selected' : ''}>Disponible</option>
                <option value="out" ${currentFilters.availability === 'out' ? 'selected' : ''}>Indisponible</option>
            </select>
        </div>
        <div class="filter-group">
            <label>Note minimum</label>
            <select id="filterRating">
                <option value="0" ${currentFilters.minRating === 0 ? 'selected' : ''}>Toutes les notes</option>
                <option value="3" ${currentFilters.minRating === 3 ? 'selected' : ''}>3★ et plus</option>
                <option value="4" ${currentFilters.minRating === 4 ? 'selected' : ''}>4★ et plus</option>
                <option value="5" ${currentFilters.minRating === 5 ? 'selected' : ''}>5★ uniquement</option>
            </select>
        </div>
        <div class="filter-group checkbox-group">
            <label><input type="checkbox" id="filterDiscount" ${currentFilters.discountOnly ? 'checked' : ''}> Uniquement en promotion</label>
        </div>
        <button class="btn btn-outline" id="resetFiltersBtn" style="width:100%;margin-top:8px;"><i class="fas fa-redo"></i> Réinitialiser</button>
    `;
}

function attachFilterEvents() {
    const applyNow = () => {
        currentFilters.minPrice = parseFloat(document.getElementById('filterMinPrice').value) || 0;
        const maxVal = document.getElementById('filterMaxPrice').value;
        currentFilters.maxPrice = maxVal ? parseFloat(maxVal) : 20000;
        currentFilters.availability = document.getElementById('filterAvailability').value;
        currentFilters.minRating = parseFloat(document.getElementById('filterRating').value) || 0;
        currentFilters.discountOnly = document.getElementById('filterDiscount').checked;
        refreshGrid();
    };
    ['filterMinPrice', 'filterMaxPrice'].forEach(id => document.getElementById(id)?.addEventListener('input', applyNow));
    ['filterAvailability', 'filterRating'].forEach(id => document.getElementById(id)?.addEventListener('change', applyNow));
    document.getElementById('filterDiscount')?.addEventListener('change', applyNow);
    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
        currentFilters.sort = e.target.value;
        refreshGrid();
    });
    document.getElementById('resetFiltersBtn')?.addEventListener('click', () => {
        const preserved = { sort: currentFilters.sort, category: currentFilters.category, search: currentFilters.search };
        currentFilters = { minPrice: 0, maxPrice: 20000, availability: 'all', minRating: 0, discountOnly: false, ...preserved };
        document.getElementById('filtersPanel').innerHTML = renderFiltersHTML();
        attachFilterEvents();
        refreshGrid();
    });
}

function refreshGrid() {
    const filtered = filterAndSortProducts(_listingBaseProducts, currentFilters);
    const grid = document.getElementById('productGrid');
    const countEl = document.getElementById('resultCount');
    if (countEl) countEl.textContent = `${filtered.length} produit(s) trouvé(s)`;
    if (!grid) return;
    if (filtered.length === 0) {
        grid.innerHTML = `<p style="grid-column:1/-1;text-align:center;padding:64px 24px;color:var(--text-secondary);">
            <i class="fas fa-search" style="font-size:48px;opacity:0.3;display:block;margin-bottom:16px;"></i>
            Aucun produit ne correspond à ces filtres.<br><small>Essayez d'élargir votre recherche.</small>
        </p>`;
    } else {
        grid.innerHTML = filtered.map(p => renderProductCard(p)).join('');
        attachProductCardEvents();
    }
}

// ---------- HOME ----------
function renderHomePage() {
    const app = document.getElementById('app');
    const heroSlides = getHeroSlides();
    const bestSellers = getActiveProducts().filter(p => p.bestseller).slice(0, 4);
    const newProducts = getActiveProducts().filter(p => p.newProduct).slice(0, 4);
    const featured = getActiveProducts().filter(p => p.featured).slice(0, 4);
    const categories = getActiveCategories();

    app.innerHTML = `
        <section class="hero">
            <div class="hero-slider">
                <div class="hero-content" id="heroContent"></div>
                <div class="hero-image" id="heroImage"></div>
                ${heroSlides.length > 1 ? `
                    <button class="hero-arrow hero-previous" type="button" id="heroPrevious" aria-label="Diapositive précédente"><i class="fas fa-chevron-left"></i></button>
                    <button class="hero-arrow hero-next" type="button" id="heroNext" aria-label="Diapositive suivante"><i class="fas fa-chevron-right"></i></button>
                ` : ''}
            </div>
            ${heroSlides.length > 1 ? `
                <div class="hero-dots" aria-label="Choisir une diapositive">
                    ${heroSlides.map((slide, index) => `<button type="button" class="${index === 0 ? 'active' : ''}" data-hero-index="${index}" aria-label="Afficher la diapositive ${index + 1}" aria-pressed="${index === 0}"></button>`).join('')}
                </div>
            ` : ''}
        </section>

        <section style="margin-top:16px;">
            <div class="section-header">
                <div><h2 class="section-title">Catégories populaires</h2><p class="section-sub">Trouvez tout ce dont vous avez besoin</p></div>
                <a href="#/categories">Voir tout <i class="fas fa-chevron-right"></i></a>
            </div>
            <div class="category-grid">
                ${categories.slice(0, 10).map(c => `
                    <div class="category-card" data-route="#/categorie/${c.id}">
                        <i class="fas ${c.icon}"></i><span>${c.name}</span>
                    </div>
                `).join('')}
            </div>
        </section>

        <section>
            <div class="section-header">
                <div><h2 class="section-title">Meilleures ventes</h2><p class="section-sub">Les produits les plus appréciés par nos clients</p></div>
                <a href="#/meilleures-ventes">Voir tout <i class="fas fa-chevron-right"></i></a>
            </div>
            <div class="product-carousel">${bestSellers.map(renderProductCard).join('')}</div>
        </section>

        <section class="promo-grid">
            <div class="promo-card">
                <span class="badge promo-badge">Offre limitée</span>
                <h3>-30% sur la mode</h3>
                <p>Profitez de réductions exceptionnelles sur une large sélection de vêtements et accessoires.</p>
                <a href="#/promotions" class="btn btn-primary promo-action">J'en profite</a>
            </div>
            <div class="promo-card promo-card-shipping">
                <span class="badge promo-badge promo-badge-shipping">Livraison gratuite</span>
                <h3>Dès 300 DH d'achat</h3>
                <p>Livraison offerte partout au Maroc pour toute commande supérieure à 300 DH.</p>
                <a href="#/contact" class="btn btn-outline promo-action">En savoir plus</a>
            </div>
        </section>

        <section>
            <div class="section-header">
                <div><h2 class="section-title">Nouveautés</h2><p class="section-sub">Les derniers produits ajoutés</p></div>
                <a href="#/nouveautes">Voir tout <i class="fas fa-chevron-right"></i></a>
            </div>
            <div class="product-carousel">${newProducts.map(renderProductCard).join('')}</div>
        </section>

        <section style="margin-bottom:48px;">
            <div class="section-header">
                <div><h2 class="section-title">Produits recommandés</h2><p class="section-sub">Sélectionnés spécialement pour vous</p></div>
                <a href="#/categories">Voir tout <i class="fas fa-chevron-right"></i></a>
            </div>
            <div class="product-carousel">${featured.map(renderProductCard).join('')}</div>
        </section>

        <section class="trust-grid">
            <div class="trust-item"><i class="fas fa-truck-fast"></i><h4>Livraison rapide</h4><p>Partout au Maroc en 24-48h</p></div>
            <div class="trust-item"><i class="fas fa-shield-alt"></i><h4>Paiement sécurisé</h4><p>Paiement à la livraison ou en ligne</p></div>
            <div class="trust-item"><i class="fas fa-headset"></i><h4>Service client</h4><p>Assistance 7j/7 par WhatsApp</p></div>
            <div class="trust-item"><i class="fas fa-undo-alt"></i><h4>Retours faciles</h4><p>Satisfait ou remboursé sous 14 jours</p></div>
        </section>

        <section class="store-location" aria-labelledby="storeLocationTitle">
            <div class="store-location-heading">
                <div>
                    <h2 id="storeLocationTitle">Visitez notre magasin</h2>
                    <p>Marchica Equipement</p>
                </div>
                <a href="https://maps.app.goo.gl/HMz6MtnQiph8H4F6A" target="_blank" rel="noopener noreferrer" class="store-directions">
                    <i class="fas fa-location-arrow"></i> Itinéraire
                </a>
            </div>
            <iframe
                src="https://www.google.com/maps/embed?origin=mfe&amp;pb=!1m3!2m1!1s35.1643373,-2.9256285!6i17"
                title="Emplacement de Marchica Equipement sur Google Maps"
                loading="lazy"
                referrerpolicy="no-referrer-when-downgrade"
                allowfullscreen>
            </iframe>
        </section>
    `;
    initHeroCarousel(heroSlides);
    attachProductCardEvents();
}

function initHeroCarousel(slides) {
    if (_heroInterval) clearInterval(_heroInterval);
    if (!slides.length) return;
    let currentIndex = 0;
    const content = document.getElementById('heroContent');
    const image = document.getElementById('heroImage');
    const dots = [...document.querySelectorAll('.hero-dots button')];

    let pointerStart = null;
    let dragged = false;
    const showSlide = (index, animate = true, direction = 'next') => {
        currentIndex = (index + slides.length) % slides.length;
        const slide = slides[currentIndex];
        const safeLink = slide.buttonLink.startsWith('#/') || /^https?:\/\//i.test(slide.buttonLink) ? slide.buttonLink : '#/';
        content.classList.remove('hero-slide-enter');
        image.classList.remove('hero-slide-enter');
        content.classList.remove('hero-slide-next', 'hero-slide-previous');
        image.classList.remove('hero-slide-next', 'hero-slide-previous');
        content.innerHTML = `
            ${slide.tag ? `<span class="tag">${escapeHTML(slide.tag)}</span>` : ''}
            <h1>${escapeHTML(slide.title)}</h1>
            ${slide.description ? `<p>${escapeHTML(slide.description)}</p>` : ''}
            ${slide.buttonText ? `<a href="${escapeHTML(safeLink)}" class="btn btn-primary">${escapeHTML(slide.buttonText)} <i class="fas fa-arrow-right"></i></a>` : ''}
        `;
        image.innerHTML = slide.image
            ? `<img src="${escapeHTML(slide.image)}" alt="${escapeHTML(slide.title)}">`
            : '';
        if (animate) {
            void content.offsetWidth;
            const directionClass = direction === 'previous' ? 'hero-slide-previous' : 'hero-slide-next';
            content.classList.add(directionClass);
            image.classList.add(directionClass);
        }
        dots.forEach((dot, dotIndex) => {
            dot.classList.toggle('active', dotIndex === currentIndex);
            dot.setAttribute('aria-pressed', String(dotIndex === currentIndex));
        });
    };

    showSlide(0, false);
    if (slides.length === 1) return;
    const slider = document.querySelector('.hero-slider');
    const resetAutoplay = () => {
        if (_heroInterval) clearInterval(_heroInterval);
        _heroInterval = slides.length > 1 ? setInterval(() => showSlide(currentIndex + 1), 12000) : null;
    };

    document.getElementById('heroPrevious').addEventListener('click', () => {
        showSlide(currentIndex - 1, true, 'previous');
        resetAutoplay();
    });
    document.getElementById('heroNext').addEventListener('click', () => {
        showSlide(currentIndex + 1, true, 'next');
        resetAutoplay();
    });
    dots.forEach(dot => dot.addEventListener('click', () => {
        const targetIndex = Number(dot.dataset.heroIndex);
        const forwardDistance = (targetIndex - currentIndex + slides.length) % slides.length;
        const direction = forwardDistance <= slides.length / 2 ? 'next' : 'previous';
        showSlide(targetIndex, true, direction);
        resetAutoplay();
    }));
    slider.addEventListener('pointerdown', event => {
        if ((event.pointerType === 'mouse' && event.button !== 0) ||
            event.target.closest('button')) return;
        pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY };
        dragged = false;
        slider.setPointerCapture(event.pointerId);
    });
    slider.addEventListener('pointermove', event => {
        if (!pointerStart || pointerStart.id !== event.pointerId) return;
        const deltaX = event.clientX - pointerStart.x;
        const deltaY = event.clientY - pointerStart.y;
        if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
            dragged = true;
            slider.classList.add('is-dragging');
        }
    });
    slider.addEventListener('pointerup', event => {
        if (!pointerStart || pointerStart.id !== event.pointerId) return;
        const deltaX = event.clientX - pointerStart.x;
        const deltaY = event.clientY - pointerStart.y;
        if (Math.abs(deltaX) >= 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.2) {
            const direction = deltaX < 0 ? 'next' : 'previous';
            showSlide(currentIndex + (direction === 'next' ? 1 : -1), true, direction);
            resetAutoplay();
        }
        pointerStart = null;
        slider.classList.remove('is-dragging');
    });
    const cancelPointer = event => {
        if (pointerStart && pointerStart.id === event.pointerId) pointerStart = null;
        slider.classList.remove('is-dragging');
    };
    slider.addEventListener('pointercancel', cancelPointer);
    slider.addEventListener('lostpointercapture', cancelPointer);
    slider.addEventListener('click', event => {
        if (!dragged) return;
        event.preventDefault();
        event.stopPropagation();
        dragged = false;
    }, true);
    resetAutoplay();
}

// ---------- PRODUCT CARD ----------
function renderProductCard(p) {
    const isFav = isFavorite(p.id);
    const available = isProductAvailable(p);
    const ratingSummary = getProductRatingSummary(p);
    return `
        <div class="product-card">
            <div class="product-image">
                <img src="${p.image}" alt="${p.name}" data-route="#/produit/${p.id}" style="cursor:pointer;">
                <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${p.id}">
                    <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
                </button>
            </div>
            <h4 data-route="#/produit/${p.id}" style="cursor:pointer;">${p.name}</h4>
            <div class="rating">${renderStars(ratingSummary.rating)} <span>(${ratingSummary.count})</span></div>
            <div class="price-row">
                <span class="price-current">${p.price} DH</span>
                ${p.oldPrice ? `<span class="price-old">${p.oldPrice} DH</span>` : ''}
                ${p.discount > 0 ? `<span class="discount-badge">-${p.discount}%</span>` : ''}
            </div>
            <button class="add-to-cart" data-id="${p.id}" ${available ? '' : 'disabled'}><i class="fas fa-shopping-cart"></i> ${available ? 'Ajouter' : 'Indisponible'}</button>
        </div>
    `;
}

function renderStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(rating)) stars += '<i class="fas fa-star"></i>';
        else if (i - 0.5 <= rating) stars += '<i class="fas fa-star-half-alt"></i>';
        else stars += '<i class="far fa-star"></i>';
    }
    return stars;
}

function getProductRatingSummary(product) {
    const approvedReviews = getProductReviews().filter(review =>
        review.productId === product.id && review.approved
    );
    if (!approvedReviews.length) return { rating: product.rating || 0, count: product.reviewCount || 0 };
    const count = (product.reviewCount || 0) + approvedReviews.length;
    const totalRating = (product.rating || 0) * (product.reviewCount || 0) +
        approvedReviews.reduce((sum, review) => sum + review.rating, 0);
    return { rating: totalRating / count, count };
}

function attachProductCardEvents() {
    document.querySelectorAll('.add-to-cart').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); addToCart(btn.dataset.id); });
    });
    document.querySelectorAll('.fav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isFav = toggleFavorite(btn.dataset.id);
            btn.classList.toggle('active', isFav);
            btn.innerHTML = `<i class="${isFav ? 'fas' : 'far'} fa-heart"></i>`;
        });
    });
}

// ---------- PRODUCT DETAIL ----------
function renderProductDetail(id) {
    const p = getProductById(id);
    if (!p) return renderHomePage();
    const isFav = isFavorite(p.id);
    const available = isProductAvailable(p);
    const ratingSummary = getProductRatingSummary(p);
    const publicReviews = getProductReviews().filter(review => review.productId === p.id && review.approved).reverse();
    const images = [p.image, ...(p.additionalImages || [])].filter(Boolean);
    const app = document.getElementById('app');
    app.innerHTML = `
        <div class="product-detail">
            <div class="product-gallery">
                <div class="main-image"><img src="${images[0]}" alt="${p.name}" id="mainProductImage"></div>
                <div class="thumbnails">
                    ${images.map((img, i) => `<img src="${img}" class="${i === 0 ? 'active' : ''}" data-index="${i}" alt="vue ${i+1}">`).join('')}
                </div>
            </div>
            <div class="product-info">
                <h1>${p.name}</h1>
                <div class="rating">${renderStars(ratingSummary.rating)} <span>(${ratingSummary.count} avis)</span></div>
                <div class="price-block">
                    <span class="current">${p.price} DH</span>
                    ${p.oldPrice ? `<span class="old">${p.oldPrice} DH</span>` : ''}
                    ${p.discount > 0 ? `<span class="discount-badge">-${p.discount}%</span>` : ''}
                </div>
                <div class="stock-status ${available ? 'in-stock' : 'out-of-stock'}">
                    ${available ? '<i class="fas fa-check-circle"></i> Disponible' : '<i class="fas fa-times-circle"></i> Indisponible'}
                </div>
                <p class="description">${p.description}</p>
                ${p.specs && Object.keys(p.specs).length ? `
                    <div class="specs">
                        <h4>Spécifications</h4>
                        <table>${Object.entries(p.specs).map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
                    </div>
                ` : ''}
                <div class="quantity-selector">
                    <button id="qtyMinus">−</button>
                    <input type="number" id="qtyInput" value="1" min="1">
                    <button id="qtyPlus">+</button>
                </div>
                <div class="product-actions">
                    <button class="btn btn-primary" id="detailAddToCart" ${available ? '' : 'disabled style="opacity:0.5;cursor:not-allowed;"'}>
                        <i class="fas fa-shopping-cart"></i> Ajouter au panier
                    </button>
                    <button class="btn btn-outline" id="detailFavBtn">
                        <i class="${isFav ? 'fas' : 'far'} fa-heart"></i> ${isFav ? 'Retirer' : 'Ajouter aux favoris'}
                    </button>
                    <button class="btn btn-whatsapp" id="detailWhatsapp" ${available ? '' : 'disabled'}><i class="fab fa-whatsapp"></i> Commander via WhatsApp</button>
                </div>
            </div>
            <section class="product-reviews" aria-labelledby="reviewsTitle">
                <h2 id="reviewsTitle">Avis clients</h2>
                ${publicReviews.length ? publicReviews.map(review => `
                    <article class="customer-review">
                        <div class="review-heading"><strong>${escapeHTML(review.name)}</strong><span>${renderStars(review.rating)} · ${new Date(review.date).toLocaleDateString('fr-FR')}</span></div>
                        <p>${escapeHTML(review.comment)}</p>
                    </article>
                `).join('') : '<p class="reviews-empty">Aucun avis publié pour le moment. Soyez le premier à donner votre avis.</p>'}
                <form id="productReviewForm" class="review-form">
                    <div class="review-form-heading">
                        <span class="review-form-icon" aria-hidden="true"><i class="fas fa-pen"></i></span>
                        <div>
                            <h3>Donner votre avis</h3>
                            <p class="reviews-note">Votre expérience aide les autres clients à faire le bon choix.</p>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label for="reviewName">Votre nom</label><input id="reviewName" maxlength="80" required></div>
                        <div class="form-group review-rating-group">
                            <span class="review-rating-label" id="reviewRatingLabel">Votre note</span>
                            <div class="review-rating" role="radiogroup" aria-labelledby="reviewRatingLabel" aria-describedby="reviewRatingHint">
                                ${[1, 2, 3, 4, 5].map(rating => `
                                    <label class="review-star" data-rating="${rating}" title="${rating} ${rating === 1 ? 'étoile' : 'étoiles'}">
                                        <input type="radio" name="reviewRating" value="${rating}" aria-label="${rating} ${rating === 1 ? 'étoile' : 'étoiles'}" required>
                                        <span aria-hidden="true">★</span>
                                    </label>
                                `).join('')}
                            </div>
                            <span class="review-rating-hint" id="reviewRatingHint" aria-live="polite">Sélectionnez une note de 1 à 5 étoiles</span>
                        </div>
                    </div>
                    <div class="form-group review-comment-group"><label for="reviewComment">Votre avis</label><textarea id="reviewComment" rows="4" maxlength="1000" placeholder="Qu’avez-vous aimé ? Comment pouvons-nous nous améliorer ?" required></textarea><span class="review-char-hint">Votre avis sera vérifié par notre équipe avant publication.</span></div>
                    <div class="review-submit-row">
                        <span class="review-private-note"><i class="fas fa-shield-alt" aria-hidden="true"></i> Publication après vérification</span>
                        <button class="btn btn-primary review-submit" type="submit"><i class="fas fa-paper-plane" aria-hidden="true"></i> Envoyer mon avis</button>
                    </div>
                </form>
            </section>
        </div>
    `;
    document.querySelectorAll('.thumbnails img').forEach(img => {
        img.addEventListener('click', () => {
            document.getElementById('mainProductImage').src = img.src;
            document.querySelectorAll('.thumbnails img').forEach(i => i.classList.remove('active'));
            img.classList.add('active');
        });
    });
    const qtyInput = document.getElementById('qtyInput');
    document.getElementById('qtyMinus').addEventListener('click', () => { qtyInput.value = Math.max(1, parseInt(qtyInput.value) - 1); });
    document.getElementById('qtyPlus').addEventListener('click', () => { qtyInput.value = parseInt(qtyInput.value) + 1; });
    document.getElementById('detailAddToCart').addEventListener('click', () => addToCart(p.id, parseInt(qtyInput.value)));
    document.getElementById('detailFavBtn').addEventListener('click', function() {
        const fav = toggleFavorite(p.id);
        this.innerHTML = `<i class="${fav ? 'fas' : 'far'} fa-heart"></i> ${fav ? 'Retirer' : 'Ajouter aux favoris'}`;
    });
    document.getElementById('detailWhatsapp').addEventListener('click', () => {
        const qty = parseInt(qtyInput.value);
        const msg =
`Bonjour, je souhaite commander :

${p.name} × ${qty} — ${p.price * qty} DH

Total produits: ${p.price * qty} DH

Nom:
Téléphone:
Ville:
Adresse:`;
        window.open(`https://wa.me/${getShopWhatsAppNumber()}?text=${encodeURIComponent(msg)}`, '_blank');
    });
    document.getElementById('productReviewForm').addEventListener('submit', async event => {
        event.preventDefault();
        const name = document.getElementById('reviewName').value.trim();
        const comment = document.getElementById('reviewComment').value.trim();
        const selectedRating = document.querySelector('input[name="reviewRating"]:checked');
        const rating = Number(selectedRating ? selectedRating.value : 0);
        if (!name || !comment || !Number.isInteger(rating) || rating < 1 || rating > 5) {
            showToast('Veuillez saisir votre nom, une note et un avis', 'error');
            return;
        }
        const reviews = getProductReviews();
        const review = {
            id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            productId: p.id,
            name,
            rating,
            comment,
            date: new Date().toISOString(),
            approved: false
        };
        if (supabaseIsConfigured() && !isSupabaseConnected()) {
            showToast('Le service des avis est momentanément indisponible. Réessayez plus tard.', 'error');
            return;
        }
        reviews.push(review);
        if (!saveProductReviews(reviews)) {
            showToast('Impossible d’enregistrer votre avis. Veuillez réessayer.', 'error');
            return;
        }
        if (isSupabaseConnected()) {
            try {
                await submitReviewToSupabase(review);
            } catch (error) {
                saveProductReviews(reviews.filter(item => item.id !== review.id));
                showToast(`Impossible d’envoyer votre avis : ${backendErrorMessage(error)}`, 'error');
                return;
            }
        }
        event.target.reset();
        reviewForm.classList.remove('is-five-star');
        delete reviewForm.dataset.rating;
        reviewForm.querySelectorAll('.review-star').forEach(star => star.classList.remove('is-selected'));
        document.getElementById('reviewRatingHint').textContent = 'Sélectionnez une note de 1 à 5 étoiles';
        showToast('Merci ! Votre avis sera publié après vérification.', 'success');
    });
    const reviewForm = document.getElementById('productReviewForm');
    reviewForm.querySelectorAll('input[name="reviewRating"]').forEach(input => {
        input.addEventListener('change', () => {
            const rating = Number(input.value);
            reviewForm.dataset.rating = String(rating);
            reviewForm.classList.toggle('is-five-star', rating === 5);
            reviewForm.querySelectorAll('.review-star').forEach(star => {
                star.classList.toggle('is-selected', Number(star.dataset.rating) <= rating);
            });
            document.getElementById('reviewRatingHint').textContent =
                `${rating} ${rating === 1 ? 'étoile' : 'étoiles'}${rating === 5 ? ' — merci pour cette excellente note !' : ''}`;
        });
    });
}

// ---------- CART PAGE ----------
function renderCartPage() {
    const cart = getCart();
    const products = getProducts();
    const app = document.getElementById('app');
    if (cart.length === 0) {
        app.innerHTML = `<div style="text-align:center;padding:80px 0;">
            <i class="fas fa-shopping-bag" style="font-size:64px;color:var(--border-light);margin-bottom:16px;"></i>
            <h2>Votre panier est vide</h2>
            <p style="color:var(--text-secondary);margin:16px 0 24px;">Ajoutez des produits pour commencer.</p>
            <a href="#/" class="btn btn-primary">Continuer les achats</a>
        </div>`;
        return;
    }
    const subtotal = getCartSubtotal(), delivery = getDeliveryFee(), total = getCartTotal();
    app.innerHTML = `
        <div class="cart-page">
            <h1>Mon panier</h1>
            <table class="cart-table">
                <thead><tr><th>Produit</th><th>Prix</th><th>Quantité</th><th>Total</th><th></th></tr></thead>
                <tbody>
                    ${cart.map(item => {
                        const p = products.find(pr => pr.id === item.productId);
                        if (!p) return '';
                        return `<tr>
                            <td><div class="cart-item-info">
                                <img src="${p.image}" alt="${p.name}">
                                <div class="details"><h4>${p.name}</h4><span>${p.price} DH</span></div>
                            </div></td>
                            <td>${p.price} DH</td>
                            <td><div class="cart-quantity">
                                <button class="cart-qty-minus" data-id="${p.id}">−</button>
                                <span>${item.quantity}</span>
                                <button class="cart-qty-plus" data-id="${p.id}">+</button>
                            </div></td>
                            <td>${(p.price * item.quantity).toFixed(2)} DH</td>
                            <td><button class="icon-btn cart-remove" data-id="${p.id}"><i class="fas fa-trash"></i></button></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            <div class="cart-summary">
                <h3>Récapitulatif</h3>
                <div class="summary-row"><span>Sous-total</span><span>${subtotal.toFixed(2)} DH</span></div>
                <div class="summary-row"><span>Livraison</span><span>${delivery === 0 ? 'Gratuite' : delivery.toFixed(2) + ' DH'}</span></div>
                <div class="summary-row total"><span>Total</span><span>${total.toFixed(2)} DH</span></div>
                <div class="actions">
                    <a href="#/" class="btn btn-outline">Continuer les achats</a>
                    <button class="btn btn-outline" id="clearCartBtn">Vider le panier</button>
                    <a href="#/checkout" class="btn btn-primary">Passer la commande</a>
                </div>
            </div>
        </div>
    `;
    document.querySelectorAll('.cart-qty-minus').forEach(b => b.addEventListener('click', () => {
        const item = getCart().find(i => i.productId === b.dataset.id);
        if (item) updateCartQuantity(b.dataset.id, item.quantity - 1);
        renderCartPage();
    }));
    document.querySelectorAll('.cart-qty-plus').forEach(b => b.addEventListener('click', () => {
        const item = getCart().find(i => i.productId === b.dataset.id);
        if (item) updateCartQuantity(b.dataset.id, item.quantity + 1);
        renderCartPage();
    }));
    document.querySelectorAll('.cart-remove').forEach(b => b.addEventListener('click', () => {
        removeFromCart(b.dataset.id); renderCartPage();
    }));
    document.getElementById('clearCartBtn')?.addEventListener('click', () => {
        if (confirm('Vider le panier ?')) { clearCart(); renderCartPage(); }
    });
}

// ---------- FAVORITES ----------
function renderFavoritesPage() {
    const favIds = getFavorites();
    const products = getActiveProducts().filter(p => favIds.includes(p.id));
    const app = document.getElementById('app');
    app.innerHTML = `
        <div style="margin:32px 0;">
            <h1 style="font-size:32px;font-weight:800;margin-bottom:32px;">Mes favoris</h1>
            ${products.length ? `<div class="product-carousel">${products.map(renderProductCard).join('')}</div>`
                : `<p style="text-align:center;padding:64px;color:var(--text-secondary);"><i class="far fa-heart" style="font-size:48px;opacity:0.3;display:block;margin-bottom:16px;"></i>Aucun favori pour le moment.</p>`}
        </div>
    `;
    attachProductCardEvents();
}

// ---------- CHECKOUT ----------
function renderCheckoutPage() {
    if (getCart().length === 0) { window.location.hash = '#/panier'; return; }
    const app = document.getElementById('app');
    app.innerHTML = `
        <section class="checkout-page">
            <h1>Finaliser la commande</h1>
            <div class="checkout-card">
                <div class="form-group"><label for="checkoutName">Nom complet *</label><input type="text" id="checkoutName" autocomplete="name" placeholder="Votre nom" required></div>
                <div class="form-group"><label for="checkoutPhone">Téléphone *</label><input type="tel" id="checkoutPhone" autocomplete="tel" placeholder="06 XX XX XX XX" required></div>
                <div class="form-group"><label for="checkoutCity">Ville *</label><input type="text" id="checkoutCity" autocomplete="address-level2" placeholder="Casablanca" required></div>
                <div class="form-group"><label for="checkoutAddress">Adresse *</label><input type="text" id="checkoutAddress" autocomplete="street-address" placeholder="Rue, quartier..." required></div>
                <div class="form-group"><label for="checkoutNotes">Notes de livraison</label><textarea id="checkoutNotes" rows="3" placeholder="Instructions supplémentaires..."></textarea></div>
                <div class="form-group"><label for="checkoutPayment">Mode de paiement</label>
                    <select id="checkoutPayment">
                        <option value="cod">Paiement à la livraison</option>
                        <option value="whatsapp">Commander via WhatsApp</option>
                    </select>
                </div>
                <div class="checkout-summary">
                    <div class="summary-row"><span>Sous-total</span><span>${getCartSubtotal().toFixed(2)} DH</span></div>
                    <div class="summary-row"><span>Livraison</span><span>${getDeliveryFee() === 0 ? 'Gratuite' : getDeliveryFee().toFixed(2) + ' DH'}</span></div>
                    <div class="summary-row total"><span>Total</span><span>${getCartTotal().toFixed(2)} DH</span></div>
                </div>
                <button class="btn btn-primary" id="placeOrderBtn">Confirmer la commande</button>
            </div>
        </section>
    `;
    document.getElementById('placeOrderBtn').addEventListener('click', async () => {
        const name = document.getElementById('checkoutName').value.trim();
        const phone = document.getElementById('checkoutPhone').value.trim();
        const city = document.getElementById('checkoutCity').value.trim();
        const address = document.getElementById('checkoutAddress').value.trim();
        const notes = document.getElementById('checkoutNotes').value.trim();
        const payment = document.getElementById('checkoutPayment').value;
        if (!name || !phone || !city || !address) {
            showToast('Veuillez remplir tous les champs obligatoires', 'error');
            return;
        }
        const notificationWindow = window.open('about:blank', '_blank');
        if (notificationWindow) notificationWindow.opener = null;
        const placeOrderButton = document.getElementById('placeOrderBtn');
        placeOrderButton.disabled = true;
        let order;
        try {
            order = await createOrder({ fullName: name, phone, city, address, notes }, payment);
        } catch (error) {
            notificationWindow?.close();
            showToast(`Impossible d’enregistrer la commande : ${backendErrorMessage(error)}`, 'error');
            placeOrderButton.disabled = false;
            return;
        }
        if (!order) {
            notificationWindow?.close();
            placeOrderButton.disabled = false;
            return;
        }
        clearCart();
        const items = order.products.map(item => `• ${item.name} × ${item.quantity} — ${(item.price * item.quantity).toFixed(2)} DH`).join('\n');
        const message =
`Nouvelle commande Marchica Equipement

Commande : ${order.orderId}
${items}

Sous-total : ${order.subtotal.toFixed(2)} DH
Livraison : ${order.deliveryFee === 0 ? 'Gratuite' : `${order.deliveryFee.toFixed(2)} DH`}
Total : ${order.total.toFixed(2)} DH

Client : ${name}
Téléphone : ${phone}
Ville : ${city}
Adresse : ${address}
Notes : ${notes || 'Aucune'}
Paiement : ${order.paymentMethod}`;
        const whatsappUrl = `https://wa.me/${getShopWhatsAppNumber()}?text=${encodeURIComponent(message)}`;
        if (notificationWindow) notificationWindow.location.href = whatsappUrl;
        document.getElementById('app').innerHTML = `
            <section class="order-confirmation">
                <i class="fas fa-check-circle"></i>
                <h1>Merci pour votre commande !</h1>
                <p>Votre numéro de commande est <strong>${escapeHTML(order.orderId)}</strong>.</p>
                <p>Un message de commande a été préparé dans WhatsApp. Envoyez-le pour informer la boutique. Si WhatsApp ne s’est pas ouvert, utilisez le bouton ci-dessous.</p>
                <div class="order-confirmation-actions">
                    <a class="btn btn-primary" href="${escapeHTML(whatsappUrl)}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Informer la boutique sur WhatsApp</a>
                    <a class="btn btn-outline" href="#/suivi?order=${encodeURIComponent(order.orderId)}">Suivre ma commande</a>
                    <a class="btn btn-outline" href="#/">Retour à la boutique</a>
                </div>
            </section>
        `;
        showToast(`Commande ${order.orderId} enregistrée !`, 'success');
    });
}

function renderOrderTrackingPage() {
    const app = document.getElementById('app');
    const orderId = new URLSearchParams(window.location.hash.split('?')[1] || '').get('order') || '';
    app.innerHTML = `
        <section class="tracking-page">
            <h1>Suivi de commande</h1>
            <p class="tracking-intro">Saisissez votre numéro de commande et le téléphone utilisé lors de la commande.</p>
            <form id="orderTrackingForm" class="tracking-form">
                <div class="form-row">
                    <div class="form-group"><label for="trackingOrderId">Numéro de commande</label><input id="trackingOrderId" value="${escapeHTML(orderId)}" placeholder="CMD-..." required></div>
                    <div class="form-group"><label for="trackingPhone">Téléphone de commande</label><input id="trackingPhone" type="tel" placeholder="06 XX XX XX XX" required></div>
                </div>
                <button class="btn btn-primary" type="submit"><i class="fas fa-search"></i> Rechercher</button>
            </form>
            <div id="trackingResult" aria-live="polite"></div>
            <p class="tracking-local-note">${isSupabaseConnected()
                ? 'Le suivi vérifie votre commande dans la base de données sécurisée de la boutique.'
                : 'Le suivi utilise uniquement les commandes enregistrées sur cet appareil. Le suivi partagé sera disponible après la configuration de Supabase.'}</p>
        </section>
    `;
    document.getElementById('orderTrackingForm').addEventListener('submit', async event => {
        event.preventDefault();
        const id = document.getElementById('trackingOrderId').value.trim();
        const phone = document.getElementById('trackingPhone').value.trim();
        const result = document.getElementById('trackingResult');
        let order;
        try {
            order = await findOrderForCustomer(id, phone);
        } catch (error) {
            result.innerHTML = `<p class="tracking-error">${escapeHTML(backendErrorMessage(error))}</p>`;
            return;
        }
        if (!order) {
            result.innerHTML = '<p class="tracking-error">Aucune commande correspondante trouvée sur cet appareil. Vérifiez les informations saisies.</p>';
            return;
        }
        const statuses = ['Nouvelle', 'Confirmée', 'En préparation', 'Expédiée', 'Livrée'];
        if (order.status === 'Annulée') {
            result.innerHTML = `<div class="tracking-card"><h2>Commande ${escapeHTML(order.orderId)}</h2><p class="tracking-cancelled"><i class="fas fa-times-circle"></i> Commande annulée</p></div>`;
            return;
        }
        const currentStep = Math.max(0, statuses.indexOf(order.status));
        result.innerHTML = `
            <div class="tracking-card">
                <div class="tracking-card-heading"><h2>Commande ${escapeHTML(order.orderId)}</h2><span>${new Date(order.date).toLocaleDateString('fr-FR')}</span></div>
                <p>Statut actuel : <strong>${escapeHTML(order.status)}</strong></p>
                <ol class="tracking-steps">${statuses.map((status, index) => `
                    <li class="${index < currentStep ? 'completed' : ''} ${index === currentStep ? 'current' : ''}">
                        <span>${index < currentStep ? '<i class="fas fa-check"></i>' : index + 1}</span>
                        <strong>${escapeHTML(status)}</strong>
                    </li>
                `).join('')}</ol>
                <ul class="tracking-items">${order.products.map(item => `<li>${escapeHTML(item.name)} × ${item.quantity}</li>`).join('')}</ul>
                <p class="tracking-total">Total : ${order.total.toFixed(2)} DH</p>
            </div>
        `;
    });
    if (orderId) document.getElementById('orderTrackingForm').requestSubmit();
}

// ---------- CONTACT ----------
function renderContactPage() {
    const settings = getShopSettings();
    document.getElementById('app').innerHTML = `
        <div style="margin:32px 0;">
            <h1 style="font-size:32px;font-weight:800;margin-bottom:32px;">Contactez-nous</h1>
            <section class="store-info-grid">
                <article class="store-info-card"><i class="fas fa-phone"></i><h2>Téléphone / WhatsApp</h2><a href="https://wa.me/${escapeHTML(getShopWhatsAppNumber())}" target="_blank" rel="noopener noreferrer">${escapeHTML(settings.phone)}</a></article>
                <article class="store-info-card"><i class="fas fa-map-marker-alt"></i><h2>Adresse</h2><p>${escapeHTML(settings.address)}</p><a href="https://maps.app.goo.gl/HMz6MtnQiph8H4F6A" target="_blank" rel="noopener noreferrer">Voir l’itinéraire</a></article>
                <article class="store-info-card"><i class="fas fa-clock"></i><h2>Horaires d’ouverture</h2><p>${escapeHTML(settings.openingHours).replace(/\n/g, '<br>')}</p></article>
            </section>
            <section class="store-policies">
                <article><h2>Livraison</h2><p>${escapeHTML(settings.deliveryInfo).replace(/\n/g, '<br>')}</p></article>
                <article><h2>Retours et échanges</h2><p>${escapeHTML(settings.returnsInfo).replace(/\n/g, '<br>')}</p></article>
            </section>
            <div class="contact-form contact-whatsapp">
                <h2>Une question ?</h2>
                <p>Notre équipe est à votre disposition pour vous renseigner sur les produits, les commandes et la livraison.</p>
                <a class="btn btn-whatsapp" href="https://wa.me/${escapeHTML(getShopWhatsAppNumber())}" target="_blank" rel="noopener noreferrer"><i class="fab fa-whatsapp"></i> Contacter sur WhatsApp</a>
            </div>
        </div>
    `;
}

// ---------- ALL CATEGORIES ----------
function renderAllCategoriesPage() {
    const cats = getActiveCategories();
    document.getElementById('app').innerHTML = `
        <div style="margin:32px 0;">
            <h1 style="font-size:32px;font-weight:800;margin-bottom:32px;">Toutes les catégories</h1>
            <div class="category-grid">
                ${cats.map(c => `<div class="category-card" data-route="#/categorie/${c.id}"><i class="fas ${c.icon}"></i><span>${c.name}</span></div>`).join('')}
            </div>
        </div>
    `;
}

// ---------- GLOBAL EVENTS ----------
function initEventListeners() {
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        const body = document.body;
        const icon = document.querySelector('#themeToggle i');
        if (body.classList.contains('dark')) {
            body.classList.remove('dark');
            icon.classList.replace('fa-sun', 'fa-moon');
            saveToStorage(STORAGE_KEYS.THEME, 'light');
        } else {
            body.classList.add('dark');
            icon.classList.replace('fa-moon', 'fa-sun');
            saveToStorage(STORAGE_KEYS.THEME, 'dark');
        }
    });

    document.getElementById('hamburgerBtn')?.addEventListener('click', () => {
        document.getElementById('mainNav')?.classList.toggle('open');
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => renderSearchSuggestions(e.target.value));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                performSearch(e.target.value);
                document.getElementById('searchSuggestions')?.classList.remove('active');
                searchInput.blur();
            }
        });
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-wrapper')) document.getElementById('searchSuggestions')?.classList.remove('active');
        });
    }

    updateSocialLinks();

    document.addEventListener('cartUpdated', updateCartBadge);
    document.addEventListener('favoritesUpdated', updateFavBadge);
}

function renderFooterCategories() {
    const ul = document.getElementById('footerCategories');
    if (!ul) return;
    ul.innerHTML = getActiveCategories().slice(0, 5).map(c => `<li><a href="#/categorie/${c.id}">${c.name}</a></li>`).join('');
}

// ---------- TOAST ----------
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ---------- ADMIN LOGIN ----------
function initAdminLoginEvents() {
    document.getElementById('adminLoginBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('adminEmail').value.trim();
        const p = document.getElementById('adminPassword').value;
        try {
            await adminLogin(email, p);
            handleRoute();
        } catch (error) {
            showToast(`Connexion impossible : ${backendErrorMessage(error)}`, 'error');
        }
    });
}

// ---------- ADMIN DASHBOARD ----------
function initAdminEvents() {
    document.getElementById('adminLogoutBtn')?.addEventListener('click', async () => {
        try {
            await adminLogout();
            window.location.hash = '#/';
        } catch (error) {
            showToast(`Déconnexion impossible : ${backendErrorMessage(error)}`, 'error');
        }
    });
    document.querySelectorAll('#adminNav button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#adminNav button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const tab = btn.dataset.adminTab;
            document.getElementById('adminContent').innerHTML = renderAdminTab(tab);
            attachAdminTabEvents(tab);
        });
    });
    attachAdminTabEvents('dashboard');
}

function attachAdminTabEvents(tab) {
    if (tab === 'settings') {
        document.getElementById('saveShopSettings')?.addEventListener('click', () => {
            const phone = document.getElementById('shopPhone').value.trim();
            const normalizedPhone = phone.replace(/\D/g, '');
            if (normalizedPhone.length < 8 || normalizedPhone.length > 15) {
                showToast('Saisissez un numéro international valide (8 à 15 chiffres)', 'error');
                return;
            }
            const settings = {
                phone: normalizedPhone,
                address: document.getElementById('shopAddress').value.trim(),
                openingHours: document.getElementById('shopHours').value.trim(),
                deliveryInfo: document.getElementById('shopDelivery').value.trim(),
                returnsInfo: document.getElementById('shopReturns').value.trim(),
                socialLinks: {
                    facebook: document.getElementById('shopFacebook').value.trim(),
                    instagram: document.getElementById('shopInstagram').value.trim(),
                    tiktok: document.getElementById('shopTikTok').value.trim(),
                    youtube: document.getElementById('shopYouTube').value.trim(),
                    linkedin: document.getElementById('shopLinkedIn').value.trim()
                }
            };
            if (!settings.address || !settings.openingHours || !settings.deliveryInfo || !settings.returnsInfo) {
                showToast('Veuillez compléter les informations du magasin', 'error');
                return;
            }
            const invalidSocialLink = Object.entries(settings.socialLinks).find(([, url]) => {
                if (!url) return false;
                try {
                    return new URL(url).protocol !== 'https:';
                } catch {
                    return true;
                }
            });
            if (invalidSocialLink) {
                showToast('Les liens des réseaux sociaux doivent être des URL HTTPS valides', 'error');
                return;
            }
            if (!saveShopSettings(settings)) {
                showToast('Impossible d’enregistrer les paramètres', 'error');
                return;
            }
            updateSocialLinks();
            showToast('Informations du magasin enregistrées', 'success');
        });
    }
    if (tab === 'reviews') {
        document.querySelectorAll('.approve-review').forEach(btn => btn.addEventListener('click', () => {
            const reviews = getProductReviews();
            const review = reviews.find(item => item.id === btn.dataset.id);
            if (!review) return;
            review.approved = true;
            if (!saveProductReviews(reviews)) {
                showToast('Impossible d’enregistrer la modération', 'error');
                return;
            }
            document.getElementById('adminContent').innerHTML = renderAdminReviews();
            attachAdminTabEvents('reviews');
            showToast('Avis approuvé', 'success');
        }));
        document.querySelectorAll('.delete-review').forEach(btn => btn.addEventListener('click', () => {
            if (!confirm('Supprimer cet avis ?')) return;
            const reviews = getProductReviews().filter(item => item.id !== btn.dataset.id);
            if (!saveProductReviews(reviews)) {
                showToast('Impossible de supprimer cet avis', 'error');
                return;
            }
            document.getElementById('adminContent').innerHTML = renderAdminReviews();
            attachAdminTabEvents('reviews');
            showToast('Avis supprimé', 'info');
        }));
    }
    if (tab === 'orders') {
        document.querySelectorAll('.order-status-select').forEach(select => select.addEventListener('change', () => {
            updateOrderStatus(select.dataset.orderId, select.value);
        }));
        document.querySelectorAll('.view-order').forEach(btn => btn.addEventListener('click', () => openOrderModal(btn.dataset.id)));
        document.querySelectorAll('.delete-order').forEach(btn => btn.addEventListener('click', async () => {
            if (!confirm(`Supprimer la commande ${btn.dataset.id} ?`)) return;
            btn.disabled = true;
            try {
                await deleteOrder(btn.dataset.id);
                document.getElementById('adminContent').innerHTML = renderAdminTab('orders');
                attachAdminTabEvents('orders');
            } catch (error) {
                btn.disabled = false;
                showToast(`Impossible de supprimer la commande : ${backendErrorMessage(error)}`, 'error');
            }
        }));
    }
    if (tab === 'hero') {
        document.getElementById('addHeroSlide')?.addEventListener('click', () => {
            const slides = getHeroSlides();
            const newSlide = {
                tag: 'Nouvelle bannière',
                title: 'Votre titre ici',
                description: '',
                buttonText: 'Découvrir',
                buttonLink: '#/categories',
                image: ''
            };
            if (!saveHeroSlides([...slides, newSlide])) {
                showToast('Impossible d’ajouter une bannière : espace de stockage insuffisant.', 'error');
                return;
            }
            document.getElementById('adminContent').innerHTML = renderAdminHero();
            attachAdminTabEvents('hero');
            openHeroSlideModal(slides.length);
        });
        document.querySelectorAll('.edit-hero-slide').forEach(btn => {
            btn.addEventListener('click', () => openHeroSlideModal(Number(btn.dataset.index)));
        });
        document.querySelectorAll('.delete-hero-slide').forEach(btn => {
            btn.addEventListener('click', () => {
                const slides = getHeroSlides();
                const index = Number(btn.dataset.index);
                if (slides.length <= 1) {
                    showToast('La dernière bannière ne peut pas être supprimée', 'error');
                    return;
                }
                if (!slides[index] || !confirm(`Supprimer la bannière ${index + 1} ?`)) return;
                slides.splice(index, 1);
                if (!saveHeroSlides(slides)) {
                    showToast('Impossible de supprimer la bannière', 'error');
                    return;
                }
                document.getElementById('adminContent').innerHTML = renderAdminHero();
                attachAdminTabEvents('hero');
                showToast('Bannière supprimée', 'success');
            });
        });
    }
    if (tab === 'products') {
        document.getElementById('addProductBtn')?.addEventListener('click', () => openProductModal());
        document.querySelectorAll('.edit-product').forEach(btn => btn.addEventListener('click', () => openProductModal(btn.dataset.id)));
        document.querySelectorAll('.availability-toggle').forEach(btn => btn.addEventListener('click', () => {
            const products = getProducts();
            const product = products.find(p => p.id === btn.dataset.id);
            if (!product) return;
            product.available = !isProductAvailable(product);
            setProducts(products);
            document.getElementById('adminContent').innerHTML = renderAdminProducts();
            attachAdminTabEvents('products');
        }));
        document.querySelectorAll('.delete-product').forEach(btn => btn.addEventListener('click', () => {
            if (confirm('Supprimer ce produit ?')) {
                setProducts(getProducts().filter(p => p.id !== btn.dataset.id));
                document.getElementById('adminContent').innerHTML = renderAdminProducts();
                attachAdminTabEvents('products');
                showToast('Produit supprimé', 'success');
            }
        }));
    }
    if (tab === 'categories') {
        document.getElementById('addCategoryBtn')?.addEventListener('click', () => openCategoryModal());
        document.querySelectorAll('.edit-category').forEach(btn => btn.addEventListener('click', () => openCategoryModal(btn.dataset.id)));
        document.querySelectorAll('.category-availability-toggle').forEach(btn => btn.addEventListener('click', () => {
            const categories = getCategories();
            const category = categories.find(item => item.id === btn.dataset.id);
            if (!category) return;
            category.active = category.active === false;
            setCategories(categories);
            document.getElementById('adminContent').innerHTML = renderAdminCategories();
            attachAdminTabEvents('categories');
            renderFooterCategories();
        }));
        document.querySelectorAll('.delete-category').forEach(btn => btn.addEventListener('click', () => {
            if (confirm('Supprimer cette catégorie ?')) {
                setCategories(getCategories().filter(c => c.id !== btn.dataset.id));
                document.getElementById('adminContent').innerHTML = renderAdminCategories();
                attachAdminTabEvents('categories');
                showToast('Catégorie supprimée', 'success');
            }
        }));
    }
}

// ---------- ADMIN MODALS ----------
function openModal(content) {
    const overlay = document.getElementById('modalOverlay');
    const modal = document.getElementById('modalContent');
    overlay.style.display = 'flex';
    modal.innerHTML = content;
    modal.querySelector('.close-modal')?.addEventListener('click', closeModal);
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
}
function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; }

// Expose globally
window.closeModal = closeModal;
window.showToast = showToast;