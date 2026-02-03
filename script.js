// Navbar scroll effect
const navbar = document.querySelector('.navbar');
const garland = document.querySelector('.heart-garland');

window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
        garland.classList.add('hidden');
    } else {
        navbar.classList.remove('scrolled');
        garland.classList.remove('hidden');
    }
});


// Category Dropdown & Filtering
const categoryDropdownBtn = document.getElementById('categoryDropdownBtn');
const categoryDropdownMenu = document.getElementById('categoryDropdownMenu');
const selectedCategoryText = document.getElementById('selectedCategory');
const trendingGrid = document.getElementById('trendingGrid');
const viewAllBtn = document.getElementById('viewAllBtn');

let currentCategory = 'all';
let showAll = false;
const INITIAL_SHOW_COUNT = 6;

// Toggle dropdown
if (categoryDropdownBtn && categoryDropdownMenu) {
    categoryDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        categoryDropdownBtn.classList.toggle('active');
        categoryDropdownMenu.classList.toggle('show');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        categoryDropdownBtn.classList.remove('active');
        categoryDropdownMenu.classList.remove('show');
    });

    // Handle category selection
    categoryDropdownMenu.addEventListener('click', (e) => {
        const option = e.target.closest('.category-option');
        if (!option) return;

        // Update active state
        categoryDropdownMenu.querySelectorAll('.category-option').forEach(opt => {
            opt.classList.remove('active');
        });
        option.classList.add('active');

        // Update selected text
        currentCategory = option.dataset.category;
        selectedCategoryText.textContent = option.textContent;

        // Reset show all when changing category
        showAll = false;
        if (viewAllBtn) {
            viewAllBtn.textContent = 'View All';
            viewAllBtn.classList.remove('active');
        }

        // Filter gifts
        filterGifts();

        // Close dropdown
        categoryDropdownBtn.classList.remove('active');
        categoryDropdownMenu.classList.remove('show');
    });
}

// View All button
if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
        showAll = !showAll;

        if (showAll) {
            viewAllBtn.textContent = 'Show Less';
            viewAllBtn.classList.add('active');
        } else {
            viewAllBtn.textContent = 'View All';
            viewAllBtn.classList.remove('active');
        }

        filterGifts();
    });
}

// Filter gifts based on category and view all state
function filterGifts() {
    if (!trendingGrid) return;

    const allCards = trendingGrid.querySelectorAll('.product-card');
    let visibleCount = 0;

    allCards.forEach(card => {
        const categories = card.dataset.category || '';
        const matchesCategory = currentCategory === 'all' || categories.includes(currentCategory);

        if (matchesCategory) {
            visibleCount++;
            // Show if "View All" is active or within initial count
            if (showAll || visibleCount <= INITIAL_SHOW_COUNT) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        } else {
            card.classList.add('hidden');
        }
    });

    // Update View All button visibility
    if (viewAllBtn) {
        // Count total matching cards
        let totalMatching = 0;
        allCards.forEach(card => {
            const categories = card.dataset.category || '';
            if (currentCategory === 'all' || categories.includes(currentCategory)) {
                totalMatching++;
            }
        });

        // Hide "View All" if there are 6 or fewer matching cards
        if (totalMatching <= INITIAL_SHOW_COUNT) {
            viewAllBtn.style.display = 'none';
        } else {
            viewAllBtn.style.display = 'block';
        }
    }
}

// Initial filter
filterGifts();
