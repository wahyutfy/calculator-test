/**
 * CLTLayupType represents a full CLT panel composed of multiple layers.
 * Layers are stacked from top (index 0) to bottom.
 */
class CLTLayupType {
    constructor() {
        this.name = 'CLT Layup';
        /** @type {CLTLayerType[]} */
        this.layers = [];
    }

    /**
     * Add a layer to the layup
     * @param {CLTLayerType} layer
     */
    addLayer(layer) {
        this.layers.push(layer);
    }

    /**
     * Remove a layer by index
     * @param {number} index
     */
    removeLayer(index) {
        this.layers.splice(index, 1);
    }

    /**
     * Get all layers
     * @returns {CLTLayerType[]}
     */
    getLayers() {
        return this.layers;
    }

    /**
     * Total number of layers
     */
    get layerCount() {
        return this.layers.length;
    }

    /**
     * Total thickness of the panel (mm)
     */
    get totalThickness() {
        return this.layers.reduce((sum, l) => sum + l.thickness, 0);
    }

    /**
     * Centroid z-coordinates for each layer (measured from top of panel, mm).
     * Returns array of { top, center, bottom } per layer.
     */
    getLayerPositions() {
        const positions = [];
        let z = 0;
        for (const layer of this.layers) {
            positions.push({
                top:    z,
                center: z + layer.thickness / 2,
                bottom: z + layer.thickness
            });
            z += layer.thickness;
        }
        return positions;
    }

    /**
     * Validate layup is symmetric (top-to-bottom mirror)
     * Required for Shear Analogy method.
     */
    isSymmetric() {
        const n = this.layers.length;
        for (let i = 0; i < Math.floor(n / 2); i++) {
            const top = this.layers[i];
            const bot = this.layers[n - 1 - i];
            if (
                top.thickness   !== bot.thickness   ||
                top.orientation !== bot.orientation ||
                top.materialGrade.name !== bot.materialGrade.name
            ) return false;
        }
        return true;
    }

    /**
     * Check if layer count is valid for a given method.
     * Shear Analogy: 3–9 layers, symmetric
     * Gamma: 3 or 5 layers only
     */
    isValidFor(method) {
        const n = this.layerCount;
        if (method === 'shear-analogy') {
            return n >= 3 && n <= 9 && this.isSymmetric();
        }
        if (method === 'gamma') {
            return n === 3 || n === 5;
        }
        return false;
    }
}
