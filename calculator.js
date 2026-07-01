/**
 * calculator.js
 * Main controller – wires together the UI, data types, and calculation engine.
 */

/* ══════════════════════════════════════════════
   STATE
══════════════════════════════════════════════ */
let currentLayup   = null;
let currentResult  = null;
let currentMethod  = 'shear-analogy';

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function fmt(v, decimals = 2) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toExponential(2);
}
function fmtN(v, d = 2) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return Number(v).toFixed(d);
}
function deg(o) { return o === 0 ? '0°' : '90°'; }

/* ══════════════════════════════════════════════
   BUILD LAYUP FROM FORM
══════════════════════════════════════════════ */
function buildLayupFromForm() {
    const rows     = document.querySelectorAll('#layerTableBody tr');
    const layup    = new CLTLayupType();

    for (const row of rows) {
        const thickness   = parseFloat(row.querySelector('.inp-thickness').value);
        const orientation = parseInt(row.querySelector('.inp-orientation').value);
        const gradeName   = row.querySelector('.inp-grade').value;

        if (isNaN(thickness) || thickness <= 0) {
            throw new Error('Thickness must be a positive number for all layers.');
        }

        const grade = MaterialGrades[gradeName];
        if (!grade) throw new Error(`Unknown material grade: ${gradeName}`);

        layup.addLayer(new CLTLayerType(thickness, orientation, grade));
    }
    return layup;
}

/* ══════════════════════════════════════════════
   LAYER ROW FACTORY
══════════════════════════════════════════════ */
function layerRowHTML(index, thickness = 35, orientation = 0, grade = 'MGP10') {
    const gradeOptions = Object.keys(MaterialGrades)
        .map(k => `<option value="${k}" ${k === grade ? 'selected' : ''}>${k}</option>`)
        .join('');

    return `
    <tr data-index="${index}">
        <td class="text-center fw-semibold text-secondary">${index}</td>
        <td>
            <input type="number" class="form-control form-control-sm inp-thickness"
                   value="${thickness}" min="1" max="500" step="1">
        </td>
        <td>
            <select class="form-select form-select-sm inp-orientation">
                <option value="0"  ${orientation === 0  ? 'selected' : ''}>0° (Parallel)</option>
                <option value="90" ${orientation === 90 ? 'selected' : ''}>90° (Perp.)</option>
            </select>
        </td>
        <td>
            <select class="form-select form-select-sm inp-grade">
                ${gradeOptions}
            </select>
        </td>
        <td class="text-center">
            <button class="btn btn-sm btn-outline-danger btn-remove-layer" onclick="removeLayer(this)">✕</button>
        </td>
    </tr>`;
}

/* ══════════════════════════════════════════════
   LAYER MANAGEMENT
══════════════════════════════════════════════ */
function addLayer() {
    const tbody  = document.getElementById('layerTableBody');
    const n      = tbody.querySelectorAll('tr').length;
    const orient = n % 2 === 0 ? 0 : 90;   // alternate default
    tbody.insertAdjacentHTML('beforeend', layerRowHTML(n + 1, 35, orient));
    reindexRows();
}

function removeLayer(btn) {
    const tbody = document.getElementById('layerTableBody');
    if (tbody.querySelectorAll('tr').length <= 1) {
        showAlert('A layup must have at least one layer.', 'warning');
        return;
    }
    btn.closest('tr').remove();
    reindexRows();
}

function reindexRows() {
    document.querySelectorAll('#layerTableBody tr').forEach((row, i) => {
        row.dataset.index = i + 1;
        row.querySelector('td:first-child').textContent = i + 1;
    });
}

/* ══════════════════════════════════════════════
   METHOD TOGGLE
══════════════════════════════════════════════ */
function setMethod(method) {
    currentMethod = method;

    document.querySelectorAll('.btn-method').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.method === method);
    });

    document.getElementById('sectionShearAnalogy').style.display =
        method === 'shear-analogy' ? '' : 'none';
    document.getElementById('sectionGamma').style.display =
        method === 'gamma' ? '' : 'none';

    // Update span input visibility
    document.getElementById('spanGroup').style.display =
        method === 'gamma' ? '' : 'none';
}

/* ══════════════════════════════════════════════
   CALCULATE
══════════════════════════════════════════════ */
function runCalculation() {
    clearAlerts();
    try {
        const layup  = buildLayupFromForm();
        const beff   = parseFloat(document.getElementById('inpBeff').value) || 1000;
        const L      = parseFloat(document.getElementById('inpSpan').value) || 5000;

        // Validation
        if (!layup.isValidFor(currentMethod)) {
            if (currentMethod === 'shear-analogy') {
                const n = layup.layerCount;
                if (n < 3 || n > 9) {
                    throw new Error('Shear Analogy requires 3–9 layers.');
                }
                if (!layup.isSymmetric()) {
                    throw new Error('Shear Analogy requires a symmetric layup (layers must mirror top-to-bottom in thickness, orientation and grade).');
                }
            }
            if (currentMethod === 'gamma') {
                throw new Error('Gamma method only supports exactly 3 or 5 layers.');
            }
        }

        const result   = PanelProperties.calculate(layup, currentMethod, beff, L);
        currentLayup   = layup;
        currentResult  = result;

        renderResult(result, layup);
        document.getElementById('outputSection').style.display = '';
        document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth' });

    } catch (err) {
        showAlert(err.message, 'danger');
    }
}

/* ══════════════════════════════════════════════
   RENDER OUTPUT
══════════════════════════════════════════════ */
function renderResult(result, layup) {
    if (result.method === 'Shear Analogy') {
        renderShearAnalogy(result, layup);
    } else {
        renderGamma(result, layup);
    }
}

function renderShearAnalogy(result, layup) {
    const tbody = document.getElementById('saTableBody');
    tbody.innerHTML = '';

    let sumEIloc   = 0;
    let sumEIaxial = 0;

    for (const r of result.layerResults) {
        sumEIloc   += r.EI_loc;
        sumEIaxial += r.EI_axial;

        tbody.insertAdjacentHTML('beforeend', `
        <tr>
            <td class="text-center">${r.index}</td>
            <td class="text-center">${fmtN(r.thickness)}</td>
            <td class="text-center">${fmtN(r.zi, 1)}</td>
            <td class="text-center">${deg(r.orientation)}</td>
            <td class="text-end">${fmtN(r.E, 0)}</td>
            <td class="text-end">${fmt(r.bEff_b3_12)}</td>
            <td class="text-end">${fmt(r.bEff_a2)}</td>
            <td class="text-end">${fmt(r.EI_loc)}</td>
            <td class="text-end">${fmt(r.EI_axial)}</td>
        </tr>`);
    }

    // Totals row
    tbody.insertAdjacentHTML('beforeend', `
    <tr class="table-active fw-bold">
        <td colspan="7" class="text-end">Σ EI<sub>eff</sub></td>
        <td class="text-end">${fmt(sumEIloc)}</td>
        <td class="text-end">${fmt(sumEIaxial)}</td>
    </tr>`);

    document.getElementById('saEIeff').textContent =
        `${fmt(result.EIeff)} N·mm²/m`;
}

function renderGamma(result, layup) {
    const tbody = document.getElementById('gaTableBody');
    tbody.innerHTML = '';

    let sumEIloc   = 0;
    let sumEIgamma = 0;

    for (const r of result.layerResults) {
        sumEIloc   += r.EI_loc;
        sumEIgamma += r.EI_gamma;

        tbody.insertAdjacentHTML('beforeend', `
        <tr>
            <td class="text-center">${r.index}</td>
            <td class="text-center">${fmtN(r.thickness)}</td>
            <td class="text-center">${fmtN(r.zi, 1)}</td>
            <td class="text-center">${deg(r.orientation)}</td>
            <td class="text-end">${fmtN(r.E, 0)}</td>
            <td class="text-end">${fmtN(r.gamma, 4)}</td>
            <td class="text-end">${fmtN(r.ai, 2)}</td>
            <td class="text-end">${fmt(r.EI_loc)}</td>
            <td class="text-end">${fmt(r.EI_gamma)}</td>
        </tr>`);
    }

    tbody.insertAdjacentHTML('beforeend', `
    <tr class="table-active fw-bold">
        <td colspan="7" class="text-end">Σ EI<sub>eff</sub></td>
        <td class="text-end">${fmt(sumEIloc)}</td>
        <td class="text-end">${fmt(sumEIgamma)}</td>
    </tr>`);

    document.getElementById('gaEIeff').textContent =
        `${fmt(result.EIeff)} N·mm²/m`;
}

/* ══════════════════════════════════════════════
   ALERTS
══════════════════════════════════════════════ */
function showAlert(msg, type = 'danger') {
    const box = document.getElementById('alertBox');
    box.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
        <strong>${type === 'danger' ? '⚠ Error:' : '⚠'}</strong> ${msg}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    </div>`;
    box.scrollIntoView({ behavior: 'smooth' });
}
function clearAlerts() {
    document.getElementById('alertBox').innerHTML = '';
}

/* ══════════════════════════════════════════════
   INIT  – default 5-layer symmetric layup
══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
    const defaults = [
        { t: 35, o: 0,  g: 'MGP10' },
        { t: 35, o: 90, g: 'MGP10' },
        { t: 35, o: 0,  g: 'MGP10' },
        { t: 35, o: 90, g: 'MGP10' },
        { t: 35, o: 0,  g: 'MGP10' },
    ];
    const tbody = document.getElementById('layerTableBody');
    defaults.forEach((d, i) => {
        tbody.insertAdjacentHTML('beforeend', layerRowHTML(i + 1, d.t, d.o, d.g));
    });

    setMethod('shear-analogy');
});
