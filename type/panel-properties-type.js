/**
 * PanelPropertiesType holds the computed output of a panel calculation.
 */
class PanelPropertiesType {
    constructor() {
        this.method         = '';       // 'Shear Analogy' | 'Gamma'
        this.totalThickness = 0;        // mm
        this.EIeff          = 0;        // Effective bending stiffness (N·mm²/m)

        // Per-layer breakdown rows (for table rendering)
        /** @type {LayerResult[]} */
        this.layerResults   = [];

        // Gamma-specific
        this.gammaFactors   = [];       // γ_i per layer
        this.EIeff_gamma    = 0;
    }
}

/**
 * Intermediate per-layer calculation result (used in result tables)
 */
class LayerResult {
    constructor({
        index, thickness, zi, orientation,
        E, bEff_b3_12, bEff_a2, EI_loc, EI_axial,
        gamma, ai, EI_gamma
    }) {
        this.index       = index;
        this.thickness   = thickness;   // mm
        this.zi          = zi;          // centroid from top (mm)
        this.orientation = orientation; // 0 or 90
        this.E           = E;           // MPa
        this.bEff_b3_12  = bEff_b3_12; // b·t³/12 (mm⁴/m)
        this.bEff_a2     = bEff_a2;     // b·t·a² (mm⁴/m)
        this.EI_loc      = EI_loc;      // E·I_loc (N·mm²/m)
        this.EI_axial    = EI_axial;    // E·A·a² (N·mm²/m)
        this.gamma       = gamma ?? 1;
        this.ai          = ai   ?? 0;
        this.EI_gamma    = EI_gamma ?? 0;
    }
}
