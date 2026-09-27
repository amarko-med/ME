// ============================================================
// search.js — Recherche et suggestions
// ============================================================

function getSearchSuggestions(query) {
    if (!query || query.trim().length < 2) return [];
    const q = query.toLowerCase().trim();
    const products = getActiveProducts();
    const categories = getActiveCategories();
    const results = [];

    // Produits
    products.forEach(p => {
        if (p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)) {
            results.push({ type: 'product', id: p.id, name: p.name, image: p.image, price: p.price });
        }
    });
    // Catégories
    categories.forEach(c => {
        if (c.name.toLowerCase().includes(q)) {
            results.push({ type: 'category', id: c.id, name: c.name, icon: c.icon });
        }
    });
    return results.slice(0, 8);
}

function renderSearchSuggestions(query) {
    const container = document.getElementById('searchSuggestions');
    if (!container) return;
    const suggestions = getSearchSuggestions(query);
    if (suggestions.length === 0) {
        container.classList.remove('active');
        container.innerHTML = '';
        return;
    }
    container.innerHTML = suggestions.map(s => {
        if (s.type === 'product') {
            return `
                <div class="suggestion-item" data-type="product" data-id="${s.id}">
                    <img src="${s.image}" alt="${s.name}">
                    <div class="info">
                        <h5>${s.name}</h5>
                        <span>${s.price} DH</span>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="suggestion-item" data-type="category" data-id="${s.id}">
                    <i class="fas ${s.icon}" style="width:40px;text-align:center;font-size:20px;color:var(--accent);"></i>
                    <div class="info">
                        <h5>${s.name}</h5>
                        <span>Catégorie</span>
                    </div>
                </div>
            `;
        }
    }).join('');
    container.classList.add('active');

    // Écouteurs sur les suggestions
    container.querySelectorAll('.suggestion-item').forEach(el => {
        el.addEventListener('click', () => {
            const type = el.dataset.type;
            const id = el.dataset.id;
            container.classList.remove('active');
            document.getElementById('searchInput').value = '';
            if (type === 'product') {
                window.location.hash = `#/produit/${id}`;
            } else {
                window.location.hash = `#/categorie/${id}`;
            }
        });
    });
}

function performSearch(query) {
    if (!query || query.trim().length < 2) {
        showToast('Veuillez saisir au moins 2 caractères', 'info');
        return;
    }
    window.location.hash = `#/recherche?q=${encodeURIComponent(query.trim())}`;
}