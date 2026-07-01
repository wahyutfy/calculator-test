/**
 * Enum for layer orientation
 */
const Orientation = Object.freeze({
    PARALLEL: 0,    // 0° - parallel to primary direction
    PERPENDICULAR: 90  // 90° - perpendicular to primary direction
});

/**
 * CLTLayerType represents a single timber layer in a CLT panel.
 * Each layer has a thickness, orientation, and material grade.
 */
class CLTLayerType {
    /**
     * @param {number} thickness - Layer thickness in mm
     * @param {number} orientation - Layer orientation in degrees (0 or 90)
     * @param {MaterialGradeType} materialGrade - Material grade properties
     */
    constructor(thickness, orientation, materialGrade) {
        this.thickness = thickness;         // mm
        this.orientation = orientation;     // 0° or 90°
        this.materialGrade = materialGrade;
    }

    /**
     * Check if this layer is parallel (0°) to the primary direction
     */
    isParallel() {
        return this.orientation === Orientation.PARALLEL;
    }

    /**
     * Get E modulus based on orientation (parallel vs perpendicular to grain)
     * @param {boolean} primaryDirection - true = XX direction, false = YY direction
     */
    getE(primaryDirection = true) {
        if (primaryDirection) {
            return this.isParallel() ? this.materialGrade.E0 : this.materialGrade.E90;
        } else {
            return this.isParallel() ? this.materialGrade.E90 : this.materialGrade.E0;
        }
    }

    /**
     * Get shear modulus G
     */
    getG() {
        return this.materialGrade.G;
    }
}
