/* ============================================================
        1. CARGA DE DATOS Y CONFIGURACIÓN
   ============================================================ */
let db = {}; // Se llenará con el JSON

const groupDescriptions = {
    universitarios: "🎓 Universitarios\nJóvenes estudiantes, entre 18 y 23 años.",
    profesionales: "💼 Profesionales\nJóvenes en el mundo laboral, hasta 35-40 años.",
    frontera: "💍 Frontera\nParejas próximas a casarse o recién casados.",
    summit: "🏔️ Summit\nAdultos maduros o matrimonios con hijos mayores.",
    senior: "👥 Senior\nAdultos mayores de 50 años."
};

let currentCountry = null;
let currentFilter = 'todos';
let cityMarkers = [];
let markersAdded = false;

// Función principal para cargar los archivos JSON de España
async function cargarBaseDeDatos() {
    try {
        db = { "espana": {} };
        const files = [
            'Andalucía.json',
            'Aragón.json',
            'Asturias.json',
            'Islas_Baleares.json',
            'Islas_Canarias.json',
            'Cantabria.json',
            'Castilla_La_Mancha.json',
            'Castilla_León.json',
            'Cataluña.json',
            'Extremadura.json',
            'Galicia.json',
            'La_Rioja.json',
            'Madrid.json',
            'Murcia.json',
            'Navarra.json',
            'Pais_Vasco.json',
            'Comunidad_Valenciana.json',
            'Ceuta_y_Melilla.json'
        ];

        const promises = files.map(file => fetch(`Ciudades/España/${file}`).then(response => {
            if (!response.ok) {
                console.warn(`Archivo ${file} no encontrado o vacío.`);
                return {};
            }
            return response.json();
        }).catch(error => {
            console.warn(`Error al cargar ${file}:`, error);
            return {};
        }));

        const results = await Promise.all(promises);
        results.forEach(data => {
            Object.assign(db["espana"], data);
        });

        console.log("Base de datos de Hakuna cargada correctamente desde múltiples archivos.");
    } catch (error) {
        console.error("Error al cargar los JSON:", error);
    }
}

// Ejecutar carga al iniciar
cargarBaseDeDatos();

/* ============================================================ 
    MAPA INTERACTIVO (Versión Final con Zoom Inteligente)
   ============================================================ */
let churchMarkers = [];

function showMapView() {
    document.getElementById('country-selection').style.display = 'none';
    document.getElementById('city-view').style.display = 'none';
    document.getElementById('map-view').style.display = 'flex';

    const mapContainer = document.getElementById('map');
    const mobileMessage = document.getElementById('mobile-map-message');

    mapContainer.style.display = 'block';
    if (mobileMessage) mobileMessage.style.display = 'none';

    setTimeout(() => {
        initializeMap();
    }, 100);
}

function hideMapView() {
    document.getElementById('map-view').style.display = 'none';
    document.getElementById('country-selection').style.display = 'flex';
}

function initializeMap() {
    if (window.mapInstance) return;

    const map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [0, 20],
        zoom: 1.2,
        minZoom: 0.5,
        renderWorldCopies: true,
        dragRotate: false,
        attributionControl: false
    });

    window.mapInstance = map;

    map.on('load', () => {
        setTimeout(() => { map.resize(); }, 100);

        // Traducción a Español 
        const layers = map.getStyle().layers;
        layers.forEach(layer => {
            if (layer.layout && layer.layout['text-field']) {
                map.setLayoutProperty(layer.id, 'text-field', [
                    'coalesce', ['get', 'name:es'], ['get', 'name'], ['get', 'name_en']
                ]);
            }
        });

        // CARGA DE PAÍSES
        fetch('https://raw.githubusercontent.com/datasets/geo-boundaries-world-110m/master/countries.geojson')
            .then(response => response.json())
            .then(data => {
                map.addSource('world-boundaries', { 'type': 'geojson', 'data': data });

                const categorias = {
                    'europa': { color: '#a3c9e2', isos: ['ESP', 'PRT', 'FRA', 'GBR', 'DEU', 'ITA', 'CHE', 'BEL', 'NLD', 'LUX', 'POL', 'IRL'] },
                    'latam': { color: '#fbc7d4', isos: ['MEX', 'COL', 'VEN', 'ECU', 'ARG', 'URY', 'HND', 'GTM', 'CRI', 'CHL', 'PER'] },
                    'usa': { color: '#f3d5ae', isos: ['USA'] },
                    'asia': { color: '#fff9c4', isos: ['KOR'] }
                };

                Object.keys(categorias).forEach(cat => {
                    const info = categorias[cat];
                    map.addLayer({
                        'id': `relleno-${cat}`,
                        'type': 'fill',
                        'source': 'world-boundaries',
                        'filter': ['in', ['get', 'iso_a3'], ['literal', info.isos]],
                        'paint': { 'fill-color': info.color, 'fill-opacity': 0.5 }
                    });
                    map.addLayer({
                        'id': `borde-${cat}`,
                        'type': 'line',
                        'source': 'world-boundaries',
                        'filter': ['in', ['get', 'iso_a3'], ['literal', info.isos]],
                        'paint': { 'line-color': '#5a96bd', 'line-width': 1 }
                    });
                });

                // Clic en país (solo si el zoom es bajo)
                const todasLasCapas = Object.keys(categorias).map(c => `relleno-${c}`);
                todasLasCapas.forEach(layerId => {
                    map.on('click', layerId, (e) => {
                        if (map.getZoom() < 5) {
                            map.flyTo({ center: e.lngLat, zoom: 4.5, speed: 1.2 });
                        }
                    });
                });
            });

        addCityMarkers(map);
    });
}

function addCityMarkers(map) {
    if (typeof cityMarkers === 'undefined') cityMarkers = [];
    churchMarkers = [];

    for (const countryKey in db) {
        for (const regionKey in db[countryKey]) {
            for (const cityKey in db[countryKey][regionKey]) {
                const city = db[countryKey][regionKey][cityKey];

                if (city.coordinates) {
                    const [lng, lat] = city.coordinates;
                    let hasGroups = false;

                    // Procesar Iglesias (Centros)
                    for (const gKey in city.groups) {
                        const group = city.groups[gKey];
                        if (group.available && group.centros) {
                            hasGroups = true;
                            group.centros.forEach(centro => {
                                if (centro.coordinates) {
                                    const cMarker = new maplibregl.Marker({ color: '#3498db', scale: 0.7 })
                                        .setLngLat(centro.coordinates)
                                        .setPopup(new maplibregl.Popup().setHTML(`
                                            <div style="text-align: center; font-family: sans-serif; min-width: 150px;">
                                                <h3 style="margin: 0; color: #2c3e50; font-size: 14px;">${centro.lugar}</h3>
                                                <p style="margin: 5px 0; font-size: 12px; color: #7f8c8d;">Hora Santa</p>
                                                <a href="${centro.mapa}" target="_blank" style="display: inline-block; background: #3498db; color: white; text-decoration: none; padding: 5px 10px; border-radius: 4px; font-size: 11px; margin-top: 5px;">📍 Ver Mapa</a>
                                            </div>
                                        `));

                                    // AÑADIR TEXTO ENCIMA (SIN CAMBIAR DISEÑO)
                                    const el = cMarker.getElement();
                                    const text = document.createElement('span');
                                    text.className = 'marker-text-label';
                                    text.innerText = centro.lugar;
                                    el.appendChild(text);

                                    cMarker.getElement().addEventListener('click', () => {
                                        map.flyTo({ center: centro.coordinates, zoom: 16, speed: 1.2 });
                                    });
                                    churchMarkers.push(cMarker);
                                }
                            });
                        }
                    }

                    // Marcador de Ciudad
                    const marker = new maplibregl.Marker({ color: hasGroups ? '#2ecc71' : '#e74c3c' })
                        .setLngLat([lng, lat])
                        .setPopup(new maplibregl.Popup().setHTML(`
                            <div style="text-align: center;">
                                <h3 style="margin: 0 0 8px 0;">${city.name}</h3>
                                ${hasGroups ? `<button onclick="openModal('${countryKey}', '${regionKey}', '${cityKey}', 'universitarios')" style="background: #2ecc71; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Ver Info</button>` : '<p>¡Próximamente en esta ciudad!</p>'}
                            </div>
                        `));

                    // AÑADIR TEXTO "INFO" (SIN CAMBIAR DISEÑO)
                    if (hasGroups) {
                        const elCity = marker.getElement();
                        const textCity = document.createElement('span');
                        textCity.className = 'marker-text-label';
                        textCity.innerText = 'Info';
                        elCity.appendChild(textCity);
                    }

                    marker.getElement().addEventListener('click', () => {
                        map.flyTo({ center: [lng, lat], zoom: 12, speed: 1.2 });
                    });

                    cityMarkers.push(marker);
                }
            }
        }
    }

    // ESTILO PARA EL TEXTO (Se oculta por defecto y se ve en zoom 9+)
    const style = document.createElement('style');
    style.innerHTML = `
        .marker-text-label {
            display: none;
            position: absolute;
            top: -20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 255, 255, 0.85);
            padding: 2px 5px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: bold;
            color: #333;
            white-space: nowrap;
            border: 1px solid #ccc;
            pointer-events: none;
        }
        .show-labels .marker-text-label { display: block; }
    `;
    document.head.appendChild(style);

    // CONTROL DE VISIBILIDAD POR ZOOM
    map.on('zoom', () => {
        const z = map.getZoom();
        const container = map.getContainer();

        // Activar/Desactivar etiquetas según zoom 9
        if (z >= 9) container.classList.add('show-labels');
        else container.classList.remove('show-labels');

        // Mostrar ciudades
        if (z > 2 && z <= 22) {
            cityMarkers.forEach(m => { if (!m.getElement().parentElement) m.addTo(map); });
        } else {
            cityMarkers.forEach(m => m.remove());
        }

        // Mostrar iglesias
        if (z > 9) {
            churchMarkers.forEach(m => { if (!m.getElement().parentElement) m.addTo(map); });
        } else {
            churchMarkers.forEach(m => m.remove());
        }
    });

    map.fire('zoom');
}

function toggleCategoria(categoria, visible) {
    if (!window.mapInstance) return;
    const status = visible ? 'visible' : 'none';
    if (window.mapInstance.getLayer(`relleno-${categoria}`)) {
        window.mapInstance.setLayoutProperty(`relleno-${categoria}`, 'visibility', status);
        window.mapInstance.setLayoutProperty(`borde-${categoria}`, 'visibility', status);
    }
}


/* ============================================================
   2. NAVEGACIÓN ENTRE VISTAS
   ============================================================ */
function selectCountry(countryKey) {
    currentCountry = countryKey;
    document.getElementById('country-selection').style.display = 'none';
    document.getElementById('city-view').style.display = 'block';

    if (!db[countryKey] || Object.keys(db[countryKey]).length === 0) {
        document.getElementById('cities-display-container').innerHTML = `
            <div style="text-align:center; padding: 5rem; color: #173f5acc;">
                <span style="font-size: 4rem;">📍</span>
                <h3 style="margin-top:20px;">En proceso de apertura</h3>
                <p>Aún no hay ciudades registradas en esta región.</p>
            </div>`;
        document.getElementById('category-filters').style.display = 'none';
        document.getElementById('city-search').style.display = 'none';
    } else {
        document.getElementById('category-filters').style.display = 'flex';
        document.getElementById('city-search').style.display = 'inline-block';

        const mobileSelect = document.getElementById('mobile-filter-select');
        if (mobileSelect) mobileSelect.value = 'todos';
        renderCities();
    }
}

function goBack() {
    document.getElementById('city-view').style.display = 'none';
    document.getElementById('country-selection').style.display = 'flex';
    document.getElementById('city-search').value = '';
}




/* ============================================================
    3. LÓGICA DE FILTROS Y RENDERIZADO (ACTUALIZADA)
============================================================ */

/**
 * Gestiona el cambio de categoría de filtro y sincroniza la interfaz
 */
function filterCategory(category) {
    currentFilter = category;

    // 1. Sincronizar botones de Escritorio (Desktop)
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        // Si el atributo onclick del botón contiene la categoría, lo marcamos como activo
        if (btn.getAttribute('onclick').includes(`'${category}'`)) {
            btn.classList.add('active');
        }
    });

    // 2. Sincronizar el Selector de Móvil (Dropdown)
    const mobileSelect = document.getElementById('mobile-filter-select');
    if (mobileSelect) {
        mobileSelect.value = category;
    }

    // 3. Renderizar resultados pasando el valor actual del buscador
    renderCities(document.getElementById('city-search').value);
}

/**
 * Dibuja las ciudades en pantalla */
function renderCities(searchTerm = "") {
    const container = document.getElementById('cities-display-container');
    container.innerHTML = ''; // Limpiar contenedor
    const countryData = db[currentCountry];
    searchTerm = searchTerm.toLowerCase();

    // Iconos y etiquetas cortas para los indicadores de las tarjetas
    const categoryIcons = {
        universitarios: "🎓 Uni",
        profesionales: "💼 Prof",
        frontera: "💍 Front",
        summit: "🏔️ Sum",
        senior: "👥 Seni"
    };

    const categories = Object.keys(categoryIcons);

    // --- CÁLCULO DE CONTADORES ---
    // Inicializamos contadores en 0 para cada categoría
    const counts = { todos: 0 };
    categories.forEach(cat => counts[cat] = 0);

    // Recorremos los datos para contar cuántas ciudades coinciden con la búsqueda
    for (const [regionName, cities] of Object.entries(countryData)) {
        for (const [cityKey, cityData] of Object.entries(cities)) {
            const matchesSearch = cityData.name.toLowerCase().includes(searchTerm);

            if (matchesSearch) {
                let hasAnyAvailable = false;
                categories.forEach(cat => {
                    if (cityData.groups[cat] && cityData.groups[cat].available) {
                        counts[cat]++;
                        hasAnyAvailable = true;
                    }
                });
                if (hasAnyAvailable) counts.todos++;
            }
        }
    }

    // --- ACTUALIZAR INTERFAZ DE FILTROS (BOTONES) ---
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const category = btn.getAttribute('onclick').match(/filterCategory\('([^']+)'\)/)[1];
        const count = counts[category] || 0;
        const emoji = btn.innerHTML.split(' ')[0]; // Mantiene el emoji original
        const text = category.charAt(0).toUpperCase() + category.slice(1);
        btn.innerHTML = `${emoji} ${text} ${count}`;
    });

    // --- ACTUALIZAR INTERFAZ DE FILTROS (MÓVIL) ---
    const mobileSelect = document.getElementById('mobile-filter-select');
    if (mobileSelect) {
        Array.from(mobileSelect.options).forEach(option => {
            const category = option.value;
            const count = counts[category] || 0;
            const emoji = option.textContent.split(' ')[0];
            const text = category.charAt(0).toUpperCase() + category.slice(1);
            option.textContent = `${emoji} ${text} (${count})`;
        });
    }

    // --- RENDERIZADO DE TARJETAS POR REGIÓN ---
    for (const [regionName, cities] of Object.entries(countryData)) {
        let regionHtml = `
            <div class="region-section">
                <h2 class="region-title">${regionName}</h2>
                <div class="cities-grid">
        `;
        let hasVisibleCitiesInRegion = false;

        for (const [cityKey, cityData] of Object.entries(cities)) {
            // 1. Filtro por nombre (Buscador)
            const matchesSearch = cityData.name.toLowerCase().includes(searchTerm);

            // 2. Filtro por categoría (Botones o Selector)
            let matchesCategory = false;
            if (currentFilter === 'todos') {
                // Si es "todos", mostramos la ciudad si tiene AL MENOS un grupo disponible
                matchesCategory = Object.values(cityData.groups).some(g => g.available);
            } else {
                // Si hay un filtro específico, solo mostramos si ESE grupo está disponible
                matchesCategory = cityData.groups[currentFilter] && cityData.groups[currentFilter].available;
            }

            if (matchesSearch && matchesCategory) {
                hasVisibleCitiesInRegion = true;

                // Generar los indicadores visuales (bolitas de colores) para cada tarjeta
                let indicatorsHtml = '<div class="group-indicators">';
                categories.forEach(cat => {
                    const isAvailable = cityData.groups[cat] && cityData.groups[cat].available;
                    const bgClass = isAvailable ? 'available' : 'unavailable';

                    indicatorsHtml += `
                        <div class="indicator-col ${bgClass}" title="${cat}">
                            <span class="indicator-emoji">${categoryIcons[cat]}</span>
                        </div>`;
                });
                indicatorsHtml += '</div>';

                // Determinar qué pestaña abrir por defecto en el modal
                const tabToOpen = currentFilter === 'todos' ? 'universitarios' : currentFilter;

                regionHtml += `
                    <div class="city-card" onclick="openModal('${currentCountry}', '${regionName}', '${cityKey}', '${tabToOpen}')">
                        <h3>${cityData.name}</h3>
                        ${indicatorsHtml}
                    </div>
                `;
            }
        }
        regionHtml += `</div></div>`;

        // Solo añadimos la sección de la región si contiene ciudades visibles
        if (hasVisibleCitiesInRegion) {
            container.innerHTML += regionHtml;
        }
    }

    // Mensaje de estado vacío si no hay resultados
    if (container.innerHTML === '') {
        container.innerHTML = `<p style="text-align:center; padding: 2rem; color: #666;">No se han encontrado ciudades con esos criterios.</p>`;
    }
}



/* ============================================================
   4. GESTIÓN DEL MODAL (VENTANAS DE CIUDAD)
   ============================================================ */
function openModal(countryKey, regionName, cityKey, initialTab) {
    currentCountry = countryKey;
    const cityData = db[currentCountry][regionName][cityKey];
    document.getElementById('modal-city-name').innerText = cityData.name;

    const tabsContainer = document.getElementById('modal-tabs');
    const mobileSelect = document.getElementById('mobile-modal-select');

    tabsContainer.innerHTML = '';
    mobileSelect.innerHTML = '';

    // Iconos para las categorías del modal
    const categoryEmojis = {
        universitarios: "🎓",
        profesionales: "💼",
        frontera: "💍",
        summit: "🏔️",
        senior: "👥"
    };

    const categories = ['universitarios', 'profesionales', 'frontera', 'summit', 'senior'];

    categories.forEach(cat => {
        // --- 1. Crear Botones para Escritorio ---
        const btn = document.createElement('button');
        btn.className = `modal-tab`;
        if (cat === initialTab) {
            btn.classList.add('active');
        }
        btn.innerText = `${categoryEmojis[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;

        if (!cityData.groups[cat] || !cityData.groups[cat].available) {
            btn.classList.add('disabled');
            btn.style.opacity = "0.4";
            // Only allow clicking on disabled tabs on desktop, not mobile
            if (window.innerWidth > 768) {
                btn.style.cursor = "pointer";
            }
        }

        btn.onclick = () => {
            syncModalFilters(cat, cityData);
        };
        tabsContainer.appendChild(btn);

        // --- 2. Crear Opciones para el Selector Móvil ---
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = `${categoryEmojis[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`;

        // Si el grupo no está disponible, lo indicamos pero permitimos selección
        if (!cityData.groups[cat] || !cityData.groups[cat].available) {
            option.textContent += " (No disp.)";
        }
        mobileSelect.appendChild(option);
    });

    // Sincronizar el valor inicial del select
    mobileSelect.value = initialTab;

    renderModalContent(cityData, initialTab);
    document.getElementById('modal').style.display = 'flex';
}

/**
 * Sincroniza el estado visual de botones y select dentro del modal
 */
function syncModalFilters(category, cityData) {
    // Iconos para las categorías del modal
    const categoryEmojis = {
        universitarios: "🎓",
        profesionales: "💼",
        frontera: "💍",
        summit: "🏔️",
        senior: "👥"
    };

    // Actualizar botones (Desktop)
    document.querySelectorAll('.modal-tab').forEach(btn => {
        btn.classList.remove('active');
        const expectedText = `${categoryEmojis[category]} ${category.charAt(0).toUpperCase() + category.slice(1)}`;
        if (btn.innerText === expectedText) {
            btn.classList.add('active');
        }
    });

    // Actualizar Select (Mobile)
    const mobileSelect = document.getElementById('mobile-modal-select');
    if (mobileSelect) mobileSelect.value = category;

    // Renderizar contenido
    renderModalContent(cityData, category);
}



function switchModalTab(category) {
    const cityData = db[currentCountry];
    const modalName = document.getElementById('modal-city-name').innerText;
    let currentCityData = null;
    let currentRegion = null;

    for (const [regionName, cities] of Object.entries(cityData)) {
        for (const [cityKey, cityInfo] of Object.entries(cities)) {
            if (cityInfo.name === modalName) {
                currentCityData = cityInfo;
                currentRegion = regionName;
                break;
            }
        }
        if (currentCityData) break;
    }

    if (currentCityData) {
        document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
        const activeTab = document.querySelector(`.modal-tab:nth-child(${['universitarios', 'profesionales', 'frontera', 'summit', 'senior'].indexOf(category) + 1})`);
        if (activeTab) activeTab.classList.add('active');
        renderModalContent(currentCityData, category);
    }
}

function renderModalContent(cityData, category) {
    const contentDiv = document.getElementById('modal-body-content');
    const group = cityData.groups[category];

    // 1. Descripción de la categoría arriba del todo
    const fullDesc = groupDescriptions[category] || "";
    const [descTitle, ...descText] = fullDesc.split('\n');

    let html = ``;

    if (!group || !group.available) {
        html += `
            <div class="no-data-box">
                <div class="coming-soon-container">
                    <div class="coming-soon-icon">🚀</div>
                    <h4>¡Próximamente en esta ciudad!</h4>
                    <p>Esta categoría aún no está disponible aquí, pero ¡podemos cambiar eso!</p>
                    <p class="encouragement-text">¿Te animas a ser el primero en organizar una Hora Santa de ${category.charAt(0).toUpperCase() + category.slice(1)} en tu ciudad?</p>
                    <div class="contact-hint">
                        <span>📧 Contacta el responsable para más información</span>
                    </div>
                </div>
            </div>`;
        contentDiv.innerHTML = html;
        return;
    }

    // 2. Título dinámico según el sector
    const sectorName = category.charAt(0).toUpperCase() + category.slice(1);

    html += `
    <h3 style="margin-bottom: 2px;"> ${descTitle}: Hora Santa</h3>
    <p style="
        margin-top: 0; 
        margin-bottom: 25px; 
        padding-left: 5px; 
        font-size: 0.9rem; 
        color: #666; 
        font-weight: 500;
    ">
        ${descText.join(' ')}
    </p>
`;
    // 3. Listado de Centros (Parroquias)
    if (group.centros && group.centros.length > 0) {
        group.centros.forEach((centro) => {
            html += `
                <div class="parroquia-item">
                    <div class="parroquia-header" onclick="toggleParroquia(this)">
                        <span><strong>${centro.lugar}</strong> (${centro.dia})</span>
                        <span class="arrow-icon">▼</span>
                    </div>
                    <div class="parroquia-content">
                        <div style="font-size: 0.9rem; color: #444; margin-bottom: 10px;">
                            <p>🕒 <strong>Hora:</strong> ${centro.hora}</p>
                            <p>📍 <strong>Dirección:</strong> ${centro.direccion}</p>
                            <p>👤 <strong>Contacto:</strong> ${centro.contacto_nombre || centro.contacto}</p>
                        </div>
                        
                        <div class="action-grid" style="display: flex; flex-direction: column; gap: 5px;">
                            <a href="${centro.whatsapp}" target="_blank" class="btn-action btn-whatsapp">
                                📱 Unirme al WhatsApp
                            </a>
                            <a href="tel:${centro.telefono}" class="btn-action btn-phone">
                                📞 Llamar a ${centro.contacto_nombre || centro.contacto}
                            </a>
                            <a href="${centro.mapa}" target="_blank" class="btn-action btn-map">
                                📍 Ver en Google Maps
                            </a>
                        </div>
                    </div>
                </div>
            `;
        });
    }

    // 4. Secciones de Info Extra (Revolcaderos y Compartiriados ahora como Desplegables)
    html += `<div class="extra-section">`;

    if (group.revolcaderos) {
        html += `
            <div class="extra-item">
                <div class="extra-header" onclick="toggleParroquia(this)">
                    <span><strong>Revolcaderos</strong></span>
                    <span class="arrow-icon" style="transition: 0.3s;">▼</span>
                </div>
                <div class="extra-content">
                    <p style="font-size:0.95rem; color:#444; margin-bottom: 12px; line-height:1.5;">
                        ${group.revolcaderos.info || 'Grupos de formación y vida cristiana.'}
                    </p>
                    <p style="font-size:0.9rem; margin-bottom:15px;">
                        <strong>👤 Contacto:</strong> ${group.revolcaderos.contacto}
                    </p>
                    <a href="${group.revolcaderos.link}" target="_blank" class="btn-action"
                       style="background:#173f5a; color:white; border-radius:8px;">
                        📝 Inscribirme al Revolcadero
                    </a>
                </div>
            </div>
        `;
    }

    if (group.compartiriados) {
        html += `
            <div class="extra-item">
                <div class="extra-header" onclick="toggleParroquia(this)">
                    <span><strong>Compartiriados</strong></span>
                    <span class="arrow-icon" style="transition: 0.3s;">▼</span>
                </div>
                <div class="extra-content">
                    <p style="font-size:0.95rem; color:#444; margin-bottom: 12px; line-height:1.5;">
                        Proyectos de voluntariado, misión y servicio para salir de uno mismo.
                    </p>
                    <a href="${group.compartiriados}" target="_blank" class="btn-action btn-map"
                       style="background:#e7be37d8; color:#222; border-radius:8px;">
                        🔎 Ver Proyectos Disponibles
                    </a>
                </div>
            </div>
        `;
    }

    html += `</div>`;
    contentDiv.innerHTML = html;
}

// Función para abrir/cerrar sin cerrar los demás
function toggleParroquia(element) {
    const content = element.nextElementSibling;

    // ESTO ACTIVA EL COLOR DEL HEADER
    element.classList.toggle('active');

    // ESTO MUESTRA EL CONTENIDO
    content.classList.toggle('active');

    const arrow = element.querySelector('.arrow-icon');
    if (arrow) {
        arrow.style.transform = content.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
    }
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

// Función para cerrar todos los acordeones abiertos
function closeAllAccordions() {
    document.querySelectorAll('.parroquia-content.active, .extra-content.active').forEach(content => {
        content.classList.remove('active');
        const header = content.previousElementSibling;
        if (header) {
            header.classList.remove('active');
            const arrow = header.querySelector('.arrow-icon');
            if (arrow) {
                arrow.style.transform = 'rotate(0deg)';
            }
        }
    });
}




/* ============================================================
   5. INTERACCIONES EXTRA
   ============================================================ */
function toggleFooter() {
    const details = document.getElementById('footer-details');
    const btn = document.querySelector('.toggle-footer-btn');
    const isVisible = details.style.display === 'block';
    details.style.display = isVisible ? 'none' : 'block';
    btn.innerText = isVisible ? 'Ver información detallada' : 'Ocultar información';
}

window.onclick = function (event) {
    const modal = document.getElementById('modal');
    if (event.target == modal) closeModal();
}




/* ============================================================
    6. CERRAR FOOTER AL CLICAR FUERA
   ============================================================ */
document.addEventListener('click', function (event) {
    const footerDetails = document.getElementById('footer-details');
    const toggleBtn = document.querySelector('.toggle-footer-btn');

    // Si el footer está visible
    if (footerDetails.style.display === 'block') {
        // Comprobamos si el clic NO fue ni en el botón ni dentro del contenido desplegado
        if (!footerDetails.contains(event.target) && !toggleBtn.contains(event.target)) {
            footerDetails.style.display = 'none';
            toggleBtn.innerText = 'Ver información detallada';
        }
    }
});




/* ============================================================
    7. GESTIÓN DEL BOTÓN DE BORRAR EN EL BUSCADOR
============================================================ */
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.getElementById('city-search');
    const clearBtn = document.getElementById('clear-search');

    function toggleClearButton() {
        // Si el valor tiene longitud mayor a 0, mostramos (block), si no, ocultamos (none)
        clearBtn.style.display = searchInput.value.length > 0 ? 'block' : 'none';
    }

    // Escuchar cuando el usuario escribe o pega texto
    searchInput.addEventListener('input', () => {
        toggleClearButton();
        renderCities(searchInput.value); // Aprovechamos para filtrar mientras escribe
    });

    // Modificar tu función clearSearch existente o definirla aquí
    window.clearSearch = function () {
        searchInput.value = '';
        toggleClearButton();
        searchInput.focus(); // Devuelve el foco al buscador
        renderCities('');    // Resetea la lista de ciudades
    };

    // Ejecutar al cargar por si el navegador recuerda el texto
    toggleClearButton();

    // Event listener para cerrar acordeones al hacer clic fuera
    const modalBody = document.getElementById('modal-body-content');
    if (modalBody) {
        modalBody.addEventListener('click', function (event) {
            // Si el clic no es en un header de acordeón, cerrar todos
            if (!event.target.closest('.parroquia-header, .extra-header')) {
                closeAllAccordions();
            }
        });
    }
});
