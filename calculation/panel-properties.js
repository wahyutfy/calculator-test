/**
 * PanelProperties – base class
 * Implements the factory pattern: PanelProperties.calculate(layup, method, beff, L)
 */
class PanelProperties {
    /**
     * Static factory – picks the correct sub-method and runs it.
     *
     * @param {CLTLayupType} cltLayup
     * @param {'shear-analogy'|'gamma'} method
     * @param {number} beff  - effective width (mm), default 1000 mm/m
     * @param {number} L     - span length (mm), used only by Gamma
     * @returns {PanelPropertiesType}
     */
    static calculate(cltLayup, method = 'shear-analogy', beff = 1000, L = 5000) {
        if (method === 'shear-analogy') {
            return new ShearAnalogyMethod().calculate(cltLayup, beff);
        }
        if (method === 'gamma') {
            return new GammaMethod().calculate(cltLayup, beff, L);
        }
        throw new Error(`Unknown method: ${method}`);
    }
}

/* ─────────────────────────────────────────────
   SHEAR ANALOGY METHOD  (proHolz Vol.1 §4.1)
   EI_eff = Σ E_i · I_i,loc  +  Σ E_i · A_i · a_i²
   ───────────────────────────────────────────── */
class ShearAnalogyMethod extends PanelProperties {
    /**
     * @param {CLTLayupType} cltLayup
     * @param {number} beff - width per unit (mm), typically 1000
     * @returns {PanelPropertiesType}
     */
    calculate(cltLayup, beff = 1000) {
        const layers    = cltLayup.getLayers();
        const positions = cltLayup.getLayerPositions();
        const n         = layers.length;
        const result    = new PanelPropertiesType();
        result.method   = 'Shear Analogy';
        result.totalThickness = cltLayup.totalThickness;

        // ── Step 1: find neutral axis (weighted centroid) ──────────────────
        let sumEA  = 0;
        let sumEAz = 0;
        for (let i = 0; i < n; i++) {
            const layer = layers[i];
            const E     = layer.getE(true);          // parallel → primary dir
            const A     = beff * layer.thickness;    // mm²/m
            const z_i   = positions[i].center;       // from top
            sumEA  += E * A;
            sumEAz += E * A * z_i;
        }
        const z_neutral = sumEAz / sumEA;             // mm from top

        // ── Step 2: per-layer contributions ───────────────────────────────
        let EIeff = 0;
        for (let i = 0; i < n; i++) {
            const layer = layers[i];
            const t     = layer.thickness;
            const E     = layer.getE(true);
            const z_i   = positions[i].center;
            const a_i   = z_i - z_neutral;           // distance to NA

            // Local bending stiffness:  E·(b·t³/12)
            const I_loc   = beff * Math.pow(t, 3) / 12;
            const EI_loc  = E * I_loc;

            // Steiner (parallel-axis) term:  E·A·a²
            const A_i     = beff * t;
            const EI_axial = E * A_i * Math.pow(a_i, 2);

            EIeff += EI_loc + EI_axial;

            result.layerResults.push(new LayerResult({
                index:       i + 1,
                thickness:   t,
                zi:          z_i,
                orientation: layer.orientation,
                E:           E,
                bEff_b3_12:  I_loc,
                bEff_a2:     A_i * Math.pow(a_i, 2),
                EI_loc:      EI_loc,
                EI_axial:    EI_axial,
            }));
        }

        result.EIeff = EIeff;
        return result;
    }
}

/* ─────────────────────────────────────────────
   GAMMA METHOD  (proHolz Vol.1 §4.2)
   Works for 3 or 5 layers (symmetric, odd)

   γ_i = 1 / (1 + π²·E_i·A_i·s_i / (G_i·b·t_i·L²))
   EI_eff = Σ E_i·I_i,loc + Σ γ_i·E_i·A_i·a_i²
   ───────────────────────────────────────────── */
class GammaMethod extends PanelProperties {
    /**
     * @param {CLTLayupType} cltLayup
     * @param {number} beff - width per unit (mm)
     * @param {number} L    - span (mm)
     * @returns {PanelPropertiesType}
     */
    calculate(cltLayup, beff = 1000, L = 5000) {
        const layers    = cltLayup.getLayers();
        const positions = cltLayup.getLayerPositions();
        const n         = layers.length;
        const result    = new PanelPropertiesType();
        result.method   = 'Gamma';
        result.totalThickness = cltLayup.totalThickness;

        // Identify parallel layers (they carry the cross-layer shear transfer)
        // In the Gamma method, γ = 1 for the outer parallel layers (indices 0 and n-1)
        // and γ < 1 for inner parallel layers.
        // Perpendicular (90°) layers: γ is assigned based on position in the formula.

        // ── Step 1: compute γ factors ──────────────────────────────────────
        // s_i = spacing between centroids of the parallel layers sandwiching
        // the cross-layer (perpendicular) layer.
        // For a 3-layer CLT: layers 1,2,3 → γ_1=γ_3=1, γ_2 computed
        // For a 5-layer CLT: γ_1=γ_5=1, γ_2/γ_4 computed, γ_3=1 (middle parallel)

        const gammas = new Array(n).fill(1);

        // Identify cross (perpendicular) layers and their adjoining parallel layers
        for (let i = 0; i < n; i++) {
            const layer = layers[i];
            if (!layer.isParallel()) {
                // This is a cross-layer; compute γ for adjacent parallel layers
                // γ applied to the parallel layer ON EACH SIDE
                const leftIdx  = i - 1;
                const rightIdx = i + 1;

                // s_i = distance between centroids of left and right parallel layers
                if (leftIdx >= 0 && rightIdx < n) {
                    const s_i = positions[rightIdx].center - positions[leftIdx].center;

                    // γ for left parallel layer
                    if (leftIdx >= 0) {
                        const layerL = layers[leftIdx];
                        const E_L    = layerL.getE(true);
                        const A_L    = beff * layerL.thickness;
                        const G_i    = layer.getG();
                        const t_i    = layer.thickness;
                        gammas[leftIdx] = 1 / (1 + (Math.PI ** 2 * E_L * A_L * s_i) / (G_i * beff * t_i * L ** 2));
                    }
                    // γ for right parallel layer (same value by symmetry)
                    if (rightIdx < n) {
                        const layerR = layers[rightIdx];
                        const E_R    = layerR.getE(true);
                        const A_R    = beff * layerR.thickness;
                        const G_i    = layer.getG();
                        const t_i    = layer.thickness;
                        gammas[rightIdx] = 1 / (1 + (Math.PI ** 2 * E_R * A_R * s_i) / (G_i * beff * t_i * L ** 2));
                    }
                }
            }
        }

        // ── Step 2: weighted neutral axis with gamma ───────────────────────
        let sumGEA  = 0;
        let sumGEAz = 0;
        for (let i = 0; i < n; i++) {
            const E   = layers[i].getE(true);
            const A   = beff * layers[i].thickness;
            const z_i = positions[i].center;
            sumGEA  += gammas[i] * E * A;
            sumGEAz += gammas[i] * E * A * z_i;
        }
        const z_neutral = sumGEAz / sumGEA;

        // ── Step 3: EI_eff ─────────────────────────────────────────────────
        let EIeff = 0;
        for (let i = 0; i < n; i++) {
            const layer = layers[i];
            const t     = layer.thickness;
            const E     = layer.getE(true);
            const z_i   = positions[i].center;
            const a_i   = z_i - z_neutral;
            const A_i   = beff * t;
            const I_loc = beff * Math.pow(t, 3) / 12;

            const EI_loc   = E * I_loc;
            const EI_axial = gammas[i] * E * A_i * Math.pow(a_i, 2);

            EIeff += EI_loc + EI_axial;

            result.layerResults.push(new LayerResult({
                index:       i + 1,
                thickness:   t,
                zi:          z_i,
                orientation: layer.orientation,
                E:           E,
                bEff_b3_12:  I_loc,
                bEff_a2:     A_i * Math.pow(a_i, 2),
                EI_loc:      EI_loc,
                EI_axial:    EI_axial,
                gamma:       gammas[i],
                ai:          a_i,
                EI_gamma:    EI_axial,
            }));
        }

        result.EIeff       = EIeff;
        result.gammaFactors = gammas;
        return result;
    }
}
