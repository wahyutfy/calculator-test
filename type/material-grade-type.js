/**
 * MaterialGradeType holds the elastic properties of a timber grade.
 * Based on the Excel data table (MGP10, MGP12, etc.)
 */
class MaterialGradeType {
    /**
     * @param {string} name - Grade name (e.g., "MGP10")
     * @param {number} E0   - Modulus of Elasticity parallel to grain (MPa)
     * @param {number} E90  - Modulus of Elasticity perpendicular to grain (MPa)
     * @param {number} G    - Shear Modulus (MPa)
     * @param {number} fc   - Compressive strength (MPa) — for reference
     */
    constructor(name, E0, E90, G, fc = 0) {
        this.name = name;
        this.E0  = E0;    // MPa  (parallel)
        this.E90 = E90;   // MPa  (perpendicular)
        this.G   = G;     // MPa
        this.fc  = fc;
    }
}

/**
 * Standard material grade library (from the Excel Data table)
 * Grade | E0   | E90 | G (rolling shear) | fc
 * MGP10 | 1100 | 110 | 687.5             | 62.5
 * MGP12 | 1100 | 110 | 687.5             | 62.5
 */
const MaterialGrades = {
    MGP10: new MaterialGradeType('MGP10', 1100, 110, 687.5, 62.5),
    MGP12: new MaterialGradeType('MGP12', 1100, 110, 687.5, 62.5),
};
