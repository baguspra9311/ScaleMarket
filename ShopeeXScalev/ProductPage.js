    document.addEventListener('DOMContentLoaded', () => {
        // --- 1. PENGAMBILAN & PARSING DATA ---
        let scalevData;
        try {
            const scalevDataString = document.getElementById('scalev')?.getAttribute('data-scalev');
            if (scalevDataString && scalevDataString !== 'null') {
                scalevData = JSON.parse(scalevDataString);
            } else {
                throw new Error("Atribut data-scalev tidak ditemukan atau kosong.");
            }
        } catch (e) {
            console.error('Gagal mem-parsing data JSON:', e);
            document.body.innerHTML = `<p style="text-align:center; padding: 50px;">Gagal memuat data. ${e.message}</p>`;
            return;
        }

        // --- 2. NORMALISASI DATA & STATE MANAGEMENT ---
        const isBundle = !!scalevData.bundle_price_option;
        const productData = isBundle ? scalevData.bundle_price_option : scalevData.product;
        
        if (!productData) {
            console.error('Data produk atau bundel tidak ditemukan dalam `data-scalev`.');
            return;
        }

        // --- PENAMBAHAN: Set Favicon Dinamis (Jurus Pamungkas v3 - Penjaga Abadi) ---
        if (scalevData.store && scalevData.store.logo) {
            const faviconUrl = `https://cdn.scalev.id/${scalevData.store.logo}`;

            const forceFavicon = () => {
                let link = document.querySelector("link[rel~='icon']");
                if (!link || link.href !== faviconUrl) {
                    // Hapus semua favicon yang salah
                    document.querySelectorAll("link[rel~='icon'], link[rel~='shortcut icon']").forEach(l => l.remove());
                    // Buat dan pasang favicon kita
                    const newLink = document.createElement('link');
                    newLink.rel = 'icon';
                    newLink.href = faviconUrl;
                    document.head.appendChild(newLink);
                }
            };

            // Fungsi penjaga yang akan berjalan dalam loop
            const guardian = () => {
                forceFavicon();
                // Minta browser untuk menjalankan guardian lagi di frame berikutnya
                requestAnimationFrame(guardian);
            };

            // Mulai penjagaan abadi
            guardian();
        }
        
        const optionNamesMap = isBundle ? {} : {
            [productData.option1_name]: 'option1_value',
            [productData.option2_name]: 'option2_value',
            [productData.option3_name]: 'option3_value'
        };

        let currentSelectedVariant = null;
        let selectedOptions = {}; 
        let imageSources = [];
        let currentImageIndex = 0;
        let lightboxImageIndex = 0;


        // --- 3. FUNGSI HELPERS ---
        const formatPrice = (price) => {
            const numericPrice = parseFloat(price);
            if (isNaN(numericPrice)) return "Harga tidak tersedia";
            return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(numericPrice);
        };
        
        const getPriceRange = (variants) => {
            if (!variants || variants.length === 0) return formatPrice(productData.price);
            const prices = variants.map(v => parseFloat(v.price)).filter(p => !isNaN(p));
            if (prices.length === 0) return formatPrice(productData.price);
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            if (minPrice === maxPrice) return formatPrice(minPrice);
            return `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}`;
        };

        const generateCheckoutURL = (itemId, isBundle) => {
            const param = isBundle ? `bpo_ids=${itemId}` : `variant_ids=${itemId}`;
            return `${window.location.origin}/c/checkout?${param}`;
        };

        const decodeHTML = (html) => {
            if (!html) return '';
            const txt = document.createElement('textarea');
            txt.innerHTML = html;
            return txt.value;
        };

        // --- 4. FUNGSI RENDER UI ---
        const renderTitle = (name) => {
            document.getElementById('shopee-product-name').textContent = name || "Nama Produk";
            document.title = name || "Halaman Produk";
        };

        const renderPrice = (priceString) => {
            document.getElementById('shopee-product-price').textContent = priceString;
        };

        const renderDescription = (richDesc) => {
            const descElement = document.getElementById('shopee-product-description');
            descElement.innerHTML = richDesc ? decodeHTML(richDesc) : '<p>Tidak ada deskripsi untuk produk ini.</p>';
        };
        
        const renderHeaderAndBreadcrumb = (productName) => {
            const headerProductNameEl = document.getElementById('header-product-name');
            if (headerProductNameEl) headerProductNameEl.textContent = productName;
            const breadcrumbContainer = document.getElementById('shopee-breadcrumb');
            if (breadcrumbContainer) {
                breadcrumbContainer.innerHTML = `
                    <a href="/">Beranda</a> <i class="ti ti-chevron-right separator"></i>
                    <a href="#">Produk</a> <i class="ti ti-chevron-right separator"></i>
                    <span class="current">${productName}</span>`;
            }
        };

        // --- 5. LOGIKA GALERI & LIGHTBOX ---
        const lightbox = document.getElementById('shopee-lightbox');
        
        function updateGalleryState(newIndex, sources, sliderId, counterId, thumbnailContainerClasses) {
            const slider = document.getElementById(sliderId);
            const counter = document.getElementById(counterId);
            if (!slider) return;
            let activeIndex = (newIndex + sources.length) % sources.length;
            
            if (sliderId === 'shopee-main-image-slider') {
                currentImageIndex = activeIndex;
            } else {
                lightboxImageIndex = activeIndex;
            }

            slider.style.transform = `translateX(-${activeIndex * 100}%)`;
            if (counter) counter.textContent = `${activeIndex + 1}/${sources.length}`;
            thumbnailContainerClasses.forEach(className => {
                document.querySelectorAll(`.${className}`).forEach((thumb, idx) => thumb.classList.toggle('active', idx === activeIndex));
                const activeThumb = document.querySelector(`.${className}.active`);
                if(activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            });
        }

        function openLightbox(startIndex) {
            const sliderEl = document.getElementById('lightbox-image-slider');
            const mobileGalleryEl = document.getElementById('lightbox-thumbnail-gallery-mobile');
            const desktopGalleryEl = document.getElementById('lightbox-thumbnail-gallery-desktop');
            const lightboxProductNameEl = document.getElementById('lightbox-product-name');
            sliderEl.innerHTML = ''; mobileGalleryEl.innerHTML = ''; desktopGalleryEl.innerHTML = '';
            
            const name = isBundle ? (productData.bundle ? productData.bundle.public_name : productData.public_name) : productData.name;
            lightboxProductNameEl.textContent = name;

            imageSources.forEach(src => {
                const item = document.createElement('div');
                item.className = 'lightbox-image-item';
                item.innerHTML = `<img src="${src}" alt="Gambar Produk Diperbesar">`;
                sliderEl.appendChild(item);
            });
            sliderEl.style.width = `${imageSources.length * 100}%`;
            imageSources.forEach((src, index) => {
                const thumbHTML = `<img src="${src}" alt="Thumbnail ${index + 1}">`;
                const mobileThumb = document.createElement('div');
                mobileThumb.className = 'lightbox-thumbnail';
                mobileThumb.innerHTML = thumbHTML;
                mobileThumb.addEventListener('click', () => updateGalleryState(index, imageSources, 'lightbox-image-slider', 'lightbox-counter', ['lightbox-thumbnail']));
                mobileGalleryEl.appendChild(mobileThumb);
                const desktopThumb = mobileThumb.cloneNode(true);
                desktopThumb.addEventListener('click', () => updateGalleryState(index, imageSources, 'lightbox-image-slider', 'lightbox-counter', ['lightbox-thumbnail']));
                desktopGalleryEl.appendChild(desktopThumb);
            });
            lightbox.classList.add('show');
            document.body.classList.add('lightbox-open');
            updateGalleryState(startIndex, imageSources, 'lightbox-image-slider', 'lightbox-counter', ['lightbox-thumbnail']);
        }

        function closeLightbox() {
            lightbox.classList.remove('show');
            document.body.classList.remove('lightbox-open');
        }

        function renderInitialGallery(images) {
            imageSources = images && images.length > 0 ? images : ['https://placehold.co/600x600/f5f5f5/cccccc?text=No+Image'];
            const mainSliderEl = document.getElementById('shopee-main-image-slider');
            const mainGalleryEl = document.getElementById('shopee-thumbnail-gallery');
            const mainThumbWrapper = document.getElementById('main-thumbnail-wrapper');
            const mainThumbContainer = document.getElementById('main-thumbnail-container');
            mainSliderEl.innerHTML = ''; mainGalleryEl.innerHTML = '';
            
            imageSources.forEach(src => {
                const item = document.createElement('div');
                item.className = 'shopee-main-image-item';
                item.innerHTML = `<img src="${src}" alt="Gambar Produk Utama">`;
                mainSliderEl.appendChild(item);
            });

            mainThumbWrapper.style.display = 'block'; 
            imageSources.forEach((src, index) => {
                const thumb = document.createElement('div');
                thumb.className = 'shopee-thumbnail';
                thumb.innerHTML = `<img src="${src}" alt="Thumbnail ${index + 1}">`;
                thumb.addEventListener('click', (e) => {
                    e.stopPropagation();
                    updateGalleryState(index, imageSources, 'shopee-main-image-slider', 'shopee-image-counter', ['shopee-thumbnail']);
                });
                mainGalleryEl.appendChild(thumb);
            });

            setTimeout(() => {
                const showArrows = mainGalleryEl.scrollWidth > mainThumbContainer.clientWidth;
                document.getElementById('main-thumb-prev').classList.toggle('hidden', !showArrows);
                document.getElementById('main-thumb-next').classList.toggle('hidden', !showArrows);
            }, 100);
            
            updateGalleryState(0, imageSources, 'shopee-main-image-slider', 'shopee-image-counter', ['shopee-thumbnail']);
        }
        
        // --- 6. LOGIKA VARIAN (DISEMPURNAKAN) ---
        function toggleVariantWarning(show) {
            const warningEl = document.getElementById('shopee-variant-warning');
            if (warningEl) {
                warningEl.style.display = show ? 'block' : 'none';
            }
        }

        function updateProductState() {
            const buyButton = document.getElementById('shopee-buy-now-button');
            const totalOptions = [productData.option1_name, productData.option2_name, productData.option3_name].filter(Boolean).length;
            const selectedCount = Object.keys(selectedOptions).length;

            if (selectedCount < totalOptions) {
                renderPrice(getPriceRange(productData.variants));
                buyButton.dataset.ready = 'false';
                return;
            }

            const matchedVariant = productData.variants.find(variant => {
                return Object.keys(selectedOptions).every(optionName => {
                    const valueKey = optionNamesMap[optionName];
                    return variant[valueKey] === selectedOptions[optionName];
                });
            });

            if (matchedVariant) {
                currentSelectedVariant = matchedVariant;
                renderPrice(formatPrice(matchedVariant.price));
                buyButton.dataset.ready = 'true';
                buyButton.dataset.href = generateCheckoutURL(matchedVariant.id, false);
                toggleVariantWarning(false);
            } else {
                currentSelectedVariant = null;
                renderPrice(getPriceRange(productData.variants));
                buyButton.dataset.ready = 'false';
                toggleVariantWarning(true);
            }
        }

        function renderVariants() {
            const container = document.getElementById('shopee-variants-container');
            container.innerHTML = '';
            if (isBundle || !productData.variants || productData.variants.length === 0) {
                container.style.display = 'none';
                return;
            }
            container.style.display = 'block';

            ['option1', 'option2', 'option3'].forEach(optionKey => {
                const optionName = productData[`${optionKey}_name`];
                if (!optionName) return;

                const optionValues = [...new Set(productData.variants.map(v => v[`${optionKey}_value`]).filter(Boolean))];
                if (optionValues.length === 0) return;

                const row = document.createElement('div');
                row.className = 'shopee-variants-row';
                const label = document.createElement('div');
                label.className = 'shopee-section-label';
                label.textContent = optionName;
                const optionsWrapper = document.createElement('div');
                optionsWrapper.className = 'shopee-variant-options';

                optionValues.forEach(value => {
                    const btn = document.createElement('button');
                    btn.className = 'shopee-variant-btn';
                    btn.textContent = value;
                    btn.dataset.value = value;
                    
                    btn.addEventListener('click', () => {
                        if (btn.classList.contains('selected')) {
                            btn.classList.remove('selected');
                            delete selectedOptions[optionName];
                        } else {
                            optionsWrapper.querySelectorAll('.shopee-variant-btn').forEach(b => b.classList.remove('selected'));
                            btn.classList.add('selected');
                            selectedOptions[optionName] = value;
                        }
                        updateProductState();
                    });
                    optionsWrapper.appendChild(btn);
                });

                row.appendChild(label);
                row.appendChild(optionsWrapper);
                container.appendChild(row);
            });
        }

        // --- 7. INISIALISASI APLIKASI ---
        const productName = isBundle ? (productData.bundle ? productData.bundle.public_name : productData.public_name) : productData.name;
        const productImages = isBundle ? (productData.bundle ? productData.bundle.images : productData.images) : productData.images;
        const productDescription = isBundle ? (productData.bundle ? productData.bundle.rich_description : productData.rich_description) : productData.rich_description;
        let productPrice;

        renderTitle(productName);
        renderHeaderAndBreadcrumb(productName);
        renderDescription(productDescription);
        renderInitialGallery(productImages);
        
        const buyButton = document.getElementById('shopee-buy-now-button');

        if (isBundle) {
            // Logika untuk produk bundel
            try {
                const nuxtDataScript = document.getElementById('__NUXT_DATA__');
                if (nuxtDataScript) {
                    const nuxtData = JSON.parse(nuxtDataScript.textContent);
                    const bundleId = productData.id;
                    let bundlePriceValue = null;
                    for (let i = 0; i < nuxtData.length; i++) {
                        if (nuxtData[i] === bundleId) {
                            const potentialPrice = nuxtData[i + 3];
                            if (typeof potentialPrice === 'string' && potentialPrice.match(/^\d+(\.\d{2})?$/)) {
                                bundlePriceValue = potentialPrice;
                                break;
                            }
                        }
                    }
                    productPrice = bundlePriceValue ? formatPrice(parseFloat(bundlePriceValue)) : "Harga tidak tersedia";
                } else {
                    productPrice = "Harga tidak tersedia";
                }
            } catch (e) {
                console.warn('Gagal mengambil harga bundle:', e);
                productPrice = "Harga tidak tersedia";
            }
            renderPrice(productPrice);
            buyButton.dataset.ready = 'true';
            buyButton.dataset.href = generateCheckoutURL(productData.id, true);
            document.getElementById('shopee-variants-container').style.display = 'none';
        } else {
            // Logika untuk produk varian
            if (productData.variants && productData.variants.length === 1) {
                // KASUS 1: Produk tunggal (hanya 1 varian)
                const singleVariant = productData.variants[0];
                renderPrice(formatPrice(singleVariant.price)); 
                buyButton.dataset.ready = 'true';
                buyButton.dataset.href = generateCheckoutURL(singleVariant.id, false);
                document.getElementById('shopee-variants-container').style.display = 'none';
            } else {
                // KASUS 2: Produk punya banyak varian untuk dipilih
                renderPrice(getPriceRange(productData.variants));
                renderVariants();
                buyButton.dataset.ready = 'false';
            }
        }

        // --- 8. EVENT LISTENERS ---
        document.getElementById('main-image-clickable-area').addEventListener('click', () => {
            openLightbox(currentImageIndex);
        });

        document.getElementById('lightbox-close-btn-mobile').addEventListener('click', closeLightbox);
        
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox) {
                closeLightbox();
            }
        });

        document.getElementById('lightbox-arrow-prev').addEventListener('click', () => {
            updateGalleryState(lightboxImageIndex - 1, imageSources, 'lightbox-image-slider', 'lightbox-counter', ['lightbox-thumbnail']);
        });

        document.getElementById('lightbox-arrow-next').addEventListener('click', () => {
            updateGalleryState(lightboxImageIndex + 1, imageSources, 'lightbox-image-slider', 'lightbox-counter', ['lightbox-thumbnail']);
        });

        buyButton.addEventListener('click', () => {
            if (buyButton.dataset.ready === 'true') {
                window.location.href = buyButton.dataset.href;
            } else {
                toggleVariantWarning(true);
            }
        });

        const thumbContainer = document.getElementById('main-thumbnail-container');
        const thumbPrevBtn = document.getElementById('main-thumb-prev');
        const thumbNextBtn = document.getElementById('main-thumb-next');

        thumbPrevBtn.addEventListener('click', () => {
            const firstThumbnail = thumbContainer.querySelector('.shopee-thumbnail');
            if (firstThumbnail) {
                const scrollAmount = firstThumbnail.offsetWidth + 8;
                thumbContainer.scrollBy({ left: -scrollAmount });
            }
        });

        thumbNextBtn.addEventListener('click', () => {
            const firstThumbnail = thumbContainer.querySelector('.shopee-thumbnail');
            if (firstThumbnail) {
                const scrollAmount = firstThumbnail.offsetWidth + 8;
                thumbContainer.scrollBy({ left: scrollAmount });
            }
        });

        const lightboxSlider = document.getElementById('lightbox-image-slider');
        let touchStartX = 0;
        let touchEndX = 0;
        const swipeThreshold = 50; 

        lightboxSlider.addEventListener('touchstart', (e) => {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        lightboxSlider.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });

        function handleSwipe() {
            if (touchEndX < touchStartX - swipeThreshold) {
                updateGalleryState(lightboxImageIndex + 1, imageSources, 'lightbox-image-slider', 'lightbox-counter', ['lightbox-thumbnail']);
            }
            if (touchEndX > touchStartX + swipeThreshold) {
                updateGalleryState(lightboxImageIndex - 1, imageSources, 'lightbox-image-slider', 'lightbox-counter', ['lightbox-thumbnail']);
            }
        }

        const mainImageSlider = document.getElementById('shopee-main-image-slider');
        let mainGalleryTouchStartX = 0;
        let mainGalleryTouchEndX = 0;

        mainImageSlider.addEventListener('touchstart', (e) => {
            if (imageSources.length <= 1) return;
            mainGalleryTouchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        mainImageSlider.addEventListener('touchend', (e) => {
            if (imageSources.length <= 1) return;
            mainGalleryTouchEndX = e.changedTouches[0].screenX;
            handleMainGallerySwipe();
        });

        function handleMainGallerySwipe() {
            if (mainGalleryTouchEndX < mainGalleryTouchStartX - swipeThreshold) {
                updateGalleryState(currentImageIndex + 1, imageSources, 'shopee-main-image-slider', 'shopee-image-counter', ['shopee-thumbnail']);
            }
            if (mainGalleryTouchEndX > mainGalleryTouchStartX + swipeThreshold) {
                updateGalleryState(currentImageIndex - 1, imageSources, 'shopee-main-image-slider', 'shopee-image-counter', ['shopee-thumbnail']);
            }
        }

        // --- PENAMBAHAN: Jalan Ninja #1 & #3 ---
        document.addEventListener('contextmenu', event => event.preventDefault());
        document.onkeydown = function (e) {
            if(e.keyCode == 123) { return false; } // F12
            if(e.ctrlKey && e.shiftKey && e.keyCode == 'I'.charCodeAt(0)){ return false; } // Ctrl+Shift+I
            if(e.ctrlKey && e.shiftKey && e.keyCode == 'C'.charCodeAt(0)){ return false; } // Ctrl+Shift+C
            if(e.ctrlKey && e.shiftKey && e.keyCode == 'J'.charCodeAt(0)){ return false; } // Ctrl+Shift+J
            if(e.ctrlKey && e.keyCode == 'U'.charCodeAt(0)){ return false; } // Ctrl+U
        };
    });