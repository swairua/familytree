/**
 * GEDCOM Parser
 * Parses GEDCOM 5.5/5.5.1 files into a structured family tree data model
 */

class GEDCOMParser {
    constructor() {
        this.individuals = new Map();
        this.families = new Map();
        this.sources = new Map();
        this.repositories = new Map();
        this.media = new Map();
        this.notes = new Map();
        this.submitters = new Map();
        this.header = {};
        this.errors = [];
    }

    /**
     * Parse GEDCOM text content
     * @param {string} content - GEDCOM file content
     * @returns {Object} Parsed family tree data
     */
    parse(content) {
        // Reset state
        this.individuals = new Map();
        this.families = new Map();
        this.sources = new Map();
        this.repositories = new Map();
        this.media = new Map();
        this.notes = new Map();
        this.submitters = new Map();
        this.header = {};
        this.errors = [];

        // Parse lines into a tree structure
        const lines = this._parseLines(content);
        if (lines.length === 0) {
            this.errors.push('No valid GEDCOM lines found');
            return this._getResult();
        }

        // Process the tree structure
        this._processRecords(lines);

        // Build relationships
        this._buildRelationships();

        return this._getResult();
    }

    /**
     * Parse GEDCOM text into structured lines
     * @param {string} content
     * @returns {Array} Array of line objects
     */
    _parseLines(content) {
        const lines = [];
        const rawLines = content.split(/\r?\n/);

        for (let i = 0; i < rawLines.length; i++) {
            const rawLine = rawLines[i].trim();
            if (!rawLine) continue;

            // GEDCOM line format: LEVEL TAG [VALUE] [@XREF@]
            const match = rawLine.match(/^(\d+)\s+(@[^@]+@\s+)?([A-Z0-9_]+)(?:\s+(.*))?$/);
            if (!match) {
                // Try to handle continuation lines (starts with + or CONC/CONT)
                if (rawLine.startsWith('+')) {
                    if (lines.length > 0) {
                        lines[lines.length - 1].value += rawLine.substring(1);
                    }
                }
                continue;
            }

            const level = parseInt(match[1], 10);
            const xref = match[2] ? match[2].trim() : null;
            const tag = match[3];
            const value = match[4] ? match[4].trim() : '';

            lines.push({
                level,
                xref,
                tag,
                value,
                children: [],
                lineNumber: i + 1
            });
        }

        // Build tree structure
        const root = [];
        const stack = [];

        for (const line of lines) {
            while (stack.length > 0 && stack[stack.length - 1].level >= line.level) {
                stack.pop();
            }

            if (stack.length === 0) {
                root.push(line);
            } else {
                stack[stack.length - 1].children.push(line);
            }

            stack.push(line);
        }

        return root;
    }

    /**
     * Process parsed lines into records
     * @param {Array} lines - Root level lines
     */
    _processRecords(lines) {
        for (const line of lines) {
            switch (line.tag) {
                case 'HEAD':
                    this._processHeader(line);
                    break;
                case 'INDI':
                    this._processIndividual(line);
                    break;
                case 'FAM':
                    this._processFamily(line);
                    break;
                case 'SOUR':
                    this._processSource(line);
                    break;
                case 'REPO':
                    this._processRepository(line);
                    break;
                case 'OBJE':
                    this._processMedia(line);
                    break;
                case 'NOTE':
                    this._processNote(line);
                    break;
                case 'SUBM':
                    this._processSubmitter(line);
                    break;
                case 'TRLR':
                    // End of file
                    break;
                default:
                    // Unknown top-level tag, ignore
                    break;
            }
        }
    }

    /**
     * Process header record
     * @param {Object} line
     */
    _processHeader(line) {
        const header = {};
        for (const child of line.children) {
            switch (child.tag) {
                case 'SOUR':
                    header.source = child.value;
                    for (const sub of child.children) {
                        if (sub.tag === 'NAME') header.sourceName = sub.value;
                        if (sub.tag === 'VERS') header.sourceVersion = sub.value;
                        if (sub.tag === 'CORP') header.sourceCorp = sub.value;
                    }
                    break;
                case 'DEST':
                    header.destination = child.value;
                    break;
                case 'DATE':
                    header.date = child.value;
                    break;
                case 'FILE':
                    header.file = child.value;
                    break;
                case 'GEDC':
                    for (const sub of child.children) {
                        if (sub.tag === 'VERS') header.gedcomVersion = sub.value;
                        if (sub.tag === 'FORM') header.gedcomForm = sub.value;
                    }
                    break;
                case 'CHAR':
                    header.characterSet = child.value;
                    break;
                case 'LANG':
                    header.language = child.value;
                    break;
                case 'SUBM':
                    header.submitter = child.value;
                    break;
            }
        }
        this.header = header;
    }

    /**
     * Process individual record
     * @param {Object} line
     */
    _processIndividual(line) {
        const id = line.xref || `I${this.individuals.size + 1}`;
        const individual = {
            id,
            name: '',
            givenName: '',
            surname: '',
            prefix: '',
            suffix: '',
            nickname: '',
            gender: 'unknown',
            birthDate: '',
            birthPlace: '',
            deathDate: '',
            deathPlace: '',
            burialDate: '',
            burialPlace: '',
            occupation: '',
            education: '',
            religion: '',
            notes: [],
            sources: [],
            media: [],
            events: [],
            familyIds: [],
            parentFamilyIds: [],
            spouseFamilyIds: [],
            childFamilyIds: [],
            // Computed relationships
            parents: [],
            spouses: [],
            children: [],
            siblings: []
        };

        for (const child of line.children) {
            switch (child.tag) {
                case 'NAME':
                    individual.name = child.value;
                    for (const sub of child.children) {
                        switch (sub.tag) {
                            case 'GIVN': individual.givenName = sub.value; break;
                            case 'SURN': individual.surname = sub.value; break;
                            case 'NPFX': individual.prefix = sub.value; break;
                            case 'NSFX': individual.suffix = sub.value; break;
                            case 'NICK': individual.nickname = sub.value; break;
                        }
                    }
                    // Parse name if structured parts are missing
                    if (!individual.givenName && !individual.surname && individual.name) {
                        const nameParts = individual.name.split('/');
                        if (nameParts.length >= 2) {
                            individual.givenName = nameParts[0].trim();
                            individual.surname = nameParts[1].trim();
                        }
                    }
                    break;
                case 'SEX':
                    individual.gender = child.value.toLowerCase();
                    if (individual.gender === 'm') individual.gender = 'male';
                    if (individual.gender === 'f') individual.gender = 'female';
                    break;
                case 'BIRT':
                    for (const sub of child.children) {
                        if (sub.tag === 'DATE') individual.birthDate = sub.value;
                        if (sub.tag === 'PLAC') individual.birthPlace = sub.value;
                    }
                    break;
                case 'DEAT':
                    for (const sub of child.children) {
                        if (sub.tag === 'DATE') individual.deathDate = sub.value;
                        if (sub.tag === 'PLAC') individual.deathPlace = sub.value;
                    }
                    break;
                case 'BURI':
                    for (const sub of child.children) {
                        if (sub.tag === 'DATE') individual.burialDate = sub.value;
                        if (sub.tag === 'PLAC') individual.burialPlace = sub.value;
                    }
                    break;
                case 'OCCU':
                    individual.occupation = child.value;
                    break;
                case 'EDUC':
                    individual.education = child.value;
                    break;
                case 'RELI':
                    individual.religion = child.value;
                    break;
                case 'NOTE':
                    individual.notes.push(child.value);
                    break;
                case 'SOUR':
                    individual.sources.push(child.value);
                    break;
                case 'OBJE':
                    individual.media.push(child.value);
                    break;
                case 'FAMC':
                    individual.parentFamilyIds.push(child.value);
                    break;
                case 'FAMS':
                    individual.spouseFamilyIds.push(child.value);
                    break;
                case 'EVEN':
                case 'MARR':
                case 'DIV':
                case 'CENS':
                case 'RESI':
                case 'IMMI':
                case 'EMIG':
                case 'CHR':
                case 'BAPM':
                case 'CONF':
                case 'GRAD':
                case 'NATU':
                case 'PROB':
                case 'WILL':
                case 'RETI':
                    const event = {
                        type: child.tag,
                        date: '',
                        place: '',
                        description: child.value
                    };
                    for (const sub of child.children) {
                        if (sub.tag === 'DATE') event.date = sub.value;
                        if (sub.tag === 'PLAC') event.place = sub.value;
                        if (sub.tag === 'TYPE') event.type = sub.value;
                    }
                    individual.events.push(event);
                    break;
            }
        }

        // Clean up name
        if (!individual.name) {
            individual.name = [individual.prefix, individual.givenName, individual.surname, individual.suffix]
                .filter(Boolean)
                .join(' ')
                .trim();
        }
        if (!individual.name) {
            individual.name = 'Unknown';
        }

        this.individuals.set(id, individual);
    }

    /**
     * Process family record
     * @param {Object} line
     */
    _processFamily(line) {
        const id = line.xref || `F${this.families.size + 1}`;
        const family = {
            id,
            husbandId: null,
            wifeId: null,
            childrenIds: [],
            marriageDate: '',
            marriagePlace: '',
            divorceDate: '',
            notes: [],
            sources: []
        };

        for (const child of line.children) {
            switch (child.tag) {
                case 'HUSB':
                    family.husbandId = child.value;
                    break;
                case 'WIFE':
                    family.wifeId = child.value;
                    break;
                case 'CHIL':
                    family.childrenIds.push(child.value);
                    break;
                case 'MARR':
                    for (const sub of child.children) {
                        if (sub.tag === 'DATE') family.marriageDate = sub.value;
                        if (sub.tag === 'PLAC') family.marriagePlace = sub.value;
                    }
                    break;
                case 'DIV':
                    for (const sub of child.children) {
                        if (sub.tag === 'DATE') family.divorceDate = sub.value;
                    }
                    break;
                case 'NOTE':
                    family.notes.push(child.value);
                    break;
                case 'SOUR':
                    family.sources.push(child.value);
                    break;
            }
        }

        this.families.set(id, family);
    }

    /**
     * Process source record
     * @param {Object} line
     */
    _processSource(line) {
        const id = line.xref || `S${this.sources.size + 1}`;
        const source = {
            id,
            title: line.value,
            author: '',
            publisher: '',
            date: '',
            place: '',
            notes: []
        };

        for (const child of line.children) {
            switch (child.tag) {
                case 'TITL':
                    source.title = child.value;
                    break;
                case 'AUTH':
                    source.author = child.value;
                    break;
                case 'PUBL':
                    source.publisher = child.value;
                    break;
                case 'DATE':
                    source.date = child.value;
                    break;
                case 'PLAC':
                    source.place = child.value;
                    break;
                case 'NOTE':
                    source.notes.push(child.value);
                    break;
            }
        }

        this.sources.set(id, source);
    }

    /**
     * Process repository record
     * @param {Object} line
     */
    _processRepository(line) {
        const id = line.xref || `R${this.repositories.size + 1}`;
        const repo = {
            id,
            name: line.value,
            address: '',
            notes: []
        };

        for (const child of line.children) {
            if (child.tag === 'NAME') repo.name = child.value;
            if (child.tag === 'ADDR') repo.address = child.value;
            if (child.tag === 'NOTE') repo.notes.push(child.value);
        }

        this.repositories.set(id, repo);
    }

    /**
     * Process media object
     * @param {Object} line
     */
    _processMedia(line) {
        const id = line.xref || `M${this.media.size + 1}`;
        const media = {
            id,
            file: '',
            format: '',
            title: '',
            notes: []
        };

        for (const child of line.children) {
            if (child.tag === 'FILE') media.file = child.value;
            if (child.tag === 'FORM') media.format = child.value;
            if (child.tag === 'TITL') media.title = child.value;
            if (child.tag === 'NOTE') media.notes.push(child.value);
        }

        this.media.set(id, media);
    }

    /**
     * Process note record
     * @param {Object} line
     */
    _processNote(line) {
        const id = line.xref || `N${this.notes.size + 1}`;
        this.notes.set(id, line.value);
    }

    /**
     * Process submitter record
     * @param {Object} line
     */
    _processSubmitter(line) {
        const id = line.xref || `U${this.submitters.size + 1}`;
        const submitter = {
            id,
            name: line.value,
            address: ''
        };

        for (const child of line.children) {
            if (child.tag === 'NAME') submitter.name = child.value;
            if (child.tag === 'ADDR') submitter.address = child.value;
        }

        this.submitters.set(id, submitter);
    }

    /**
     * Build relationships between individuals based on family records
     */
    _buildRelationships() {
        for (const [famId, family] of this.families) {
            const husband = family.husbandId ? this.individuals.get(family.husbandId) : null;
            const wife = family.wifeId ? this.individuals.get(family.wifeId) : null;

            // Link spouses
            if (husband) {
                husband.spouses.push(wife ? wife.id : null);
                husband.spouseFamilyIds.push(famId);
            }
            if (wife) {
                wife.spouses.push(husband ? husband.id : null);
                wife.spouseFamilyIds.push(famId);
            }

            // Link children
            for (const childId of family.childrenIds) {
                const child = this.individuals.get(childId);
                if (!child) continue;

                child.parentFamilyIds.push(famId);

                if (husband) {
                    child.parents.push(husband.id);
                    husband.children.push(childId);
                }
                if (wife) {
                    child.parents.push(wife.id);
                    wife.children.push(childId);
                }
            }
        }

        // Compute siblings
        for (const [id, individual] of this.individuals) {
            const siblingIds = new Set();
            for (const famId of individual.parentFamilyIds) {
                const family = this.families.get(famId);
                if (family) {
                    for (const childId of family.childrenIds) {
                        if (childId !== id) {
                            siblingIds.add(childId);
                        }
                    }
                }
            }
            individual.siblings = Array.from(siblingIds);
        }

        // Clean up null values in spouses
        for (const [id, individual] of this.individuals) {
            individual.spouses = individual.spouses.filter(s => s !== null);
        }
    }

    /**
     * Get the final result object
     * @returns {Object}
     */
    _getResult() {
        return {
            header: this.header,
            individuals: Array.from(this.individuals.values()),
            families: Array.from(this.families.values()),
            sources: Array.from(this.sources.values()),
            repositories: Array.from(this.repositories.values()),
            media: Array.from(this.media.values()),
            notes: Array.from(this.notes.values()),
            submitters: Array.from(this.submitters.values()),
            errors: this.errors,
            stats: {
                individualCount: this.individuals.size,
                familyCount: this.families.size,
                sourceCount: this.sources.size,
                mediaCount: this.media.size
            }
        };
    }
}

// Export for browser use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GEDCOMParser;
}