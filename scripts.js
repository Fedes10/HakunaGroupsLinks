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

// Función principal para cargar el archivo JSON
async function cargarBaseDeDatos() {
    try {
        const response = await fetch('ciudades.json');
        db = await response.json();
        console.log("Base de datos de Hakuna cargada correctamente.");
    } catch (error) {
        console.error("Error al cargar el JSON:", error);
    }
}

// Ejecutar carga al iniciar
cargarBaseDeDatos();



/* ============================================================
   2. NAVEGACIÓN ENTRE VISTAS
   ============================================================ */
function selectCountry(countryKey) {
    currentCountry = countryKey;
    document.getElementById('country-selection').style.display = 'none';
    document.getElementById('city-view').style.display = 'block';

    if (!db[countryKey] || Object.keys(db[countryKey]).length === 0) {
        document.getElementById('cities-display-container').innerHTML = `
            <div style="text-align:center; padding: 5rem; color: #90a4ae;">
                <span style="font-size: 4rem;">📍</span>
                <h3 style="margin-top:20px;">En proceso de apertura</h3>
                <p>Aún no hay ciudades registradas en esta región.</p>
            </div>`;
        document.getElementById('category-filters').style.display = 'none';
        document.getElementById('city-search').style.display = 'none';
    } else {
        document.getElementById('category-filters').style.display = 'flex';
        document.getElementById('city-search').style.display = 'inline-block';
        renderCities();
    }
}

function goBack() {
    document.getElementById('city-view').style.display = 'none';
    document.getElementById('country-selection').style.display = 'flex';
    document.getElementById('city-search').value = '';
}



/* ============================================================
    3. LÓGICA DE FILTROS Y RENDERIZADO (CORREGIDA)
============================================================ */
function filterCategory(category) {
    currentFilter = category;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    // Usamos event.currentTarget para asegurar que pillamos el botón
    if (event) event.currentTarget.classList.add('active');
    renderCities(document.getElementById('city-search').value);
}

function renderCities(searchTerm = "") {
    const container = document.getElementById('cities-display-container');
    container.innerHTML = '';
    const countryData = db[currentCountry];
    searchTerm = searchTerm.toLowerCase();

    const categoryIcons = {
        universitarios: "🎓 Uni",
        profesionales: "💼 Prof",
        frontera: "💍 Front",
        summit: "🏔️ Sum",
        senior: "👥 Seni"
    };

    const categories = Object.keys(categoryIcons);

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

            // 2. Filtro por categoría (Botones de arriba)
            let matchesCategory = false;
            if (currentFilter === 'todos') {
                // Si es "todos", mostramos la ciudad si tiene AL MENOS un grupo disponible
                matchesCategory = Object.values(cityData.groups).some(g => g.available);
            } else {
                // Si hay un filtro específico, solo mostramos si ESE grupo es available
                matchesCategory = cityData.groups[currentFilter] && cityData.groups[currentFilter].available;
            }

            if (matchesSearch && matchesCategory) {
                hasVisibleCitiesInRegion = true;

                // Generar los indicadores con Emoji + Punto
                let indicatorsHtml = '<div class="group-indicators">';
                categories.forEach(cat => {
                    const isAvailable = cityData.groups[cat] && cityData.groups[cat].available;
                    const colorClass = isAvailable ? 'dot-green' : 'dot-red';

                    indicatorsHtml += `
                        <div class="indicator-col" title="${cat}">
                            <span class="indicator-emoji">${categoryIcons[cat]}</span>
                            <span class="dot ${colorClass}"></span>
                        </div>`;
                });
                indicatorsHtml += '</div>';

                // Al abrir el modal, que vaya directo a la pestaña que tenemos filtrada
                const tabToOpen = currentFilter === 'todos' ? 'universitarios' : currentFilter;

                regionHtml += `
                    <div class="city-card" onclick="openModal('${regionName}', '${cityKey}', '${tabToOpen}')">
                        <h3>${cityData.name}</h3>
                        ${indicatorsHtml}
                    </div>
                `;
            }
        }
        regionHtml += `</div></div>`;

        // Solo añadimos la región si tiene ciudades que mostrar
        if (hasVisibleCitiesInRegion) {
            container.innerHTML += regionHtml;
        }
    }

    // Si no hay ninguna ciudad en todo el país tras filtrar
    if (container.innerHTML === '') {
        container.innerHTML = `<p style="text-align:center; padding: 2rem; color: #666;">No se han encontrado ciudades con esos criterios.</p>`;
    }
}


/* ============================================================
   4. GESTIÓN DEL MODAL (VENTANAS DE CIUDAD)
   ============================================================ */
function openModal(regionName, cityKey, initialTab) {
    const cityData = db[currentCountry][regionName][cityKey];
    document.getElementById('modal-city-name').innerText = cityData.name;

    const tabsContainer = document.getElementById('modal-tabs');
    tabsContainer.innerHTML = '';

    ['universitarios', 'profesionales', 'frontera', 'summit', 'senior'].forEach(cat => {
        const btn = document.createElement('button');
        btn.className = `modal-tab ${cat === initialTab ? 'active' : ''}`;
        btn.innerText = cat.charAt(0).toUpperCase() + cat.slice(1);

        if (!cityData.groups[cat] || !cityData.groups[cat].available) btn.style.opacity = "0.4";

        btn.onclick = () => {
            document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            renderModalContent(cityData, cat);
        };
        tabsContainer.appendChild(btn);
    });

    renderModalContent(cityData, initialTab);
    document.getElementById('modal').style.display = 'flex';
}

function renderModalContent(cityData, category) {
    const contentDiv = document.getElementById('modal-body-content');
    const group = cityData.groups[category];

    // 1. Descripción de la categoría arriba del todo
    const fullDesc = groupDescriptions[category] || "";
    const [descTitle, ...descText] = fullDesc.split('\n');

    let html = ``;

    if (!group || !group.available) {
        html += `<div class="no-data-box">Esta categoría no está activa todavía aquí.</div>`;
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