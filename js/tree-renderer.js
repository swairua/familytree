/**
 * Family Tree Renderer
 * Renders the family tree as an interactive SVG visualization
 */

class TreeRenderer {
    constructor(svgElement, containerElement) {
        this.svg = svgElement;
        this.container = containerElement;
        this.data = null;
        this.individuals = new Map();
        this.families = new Map();
        this.selectedId = null;
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;
        this.layout = 'horizontal'; // horizontal or vertical
        this.nodeWidth = 160;
        this.nodeHeight = 60;
        this.hGap = 40;
        this.vGap = 30;
        this.rootId = null;

        this._initEvents();
    }

    /**
     * Initialize event handlers
     */
    _initEvents() {
        // Zoom controls
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('btn-reset').addEventListener('click', () => this.resetView());
        document.getElementById('btn-layout').addEventListener('click', () => this.toggleLayout());

        // Mouse wheel zoom
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.zoomAt(e.offsetX, e.offsetY, delta);
        });

        // Pan with mouse drag
        this.container.addEventListener('mousedown', (e) => {
            if (e.target.closest('.tree-node')) return;
            this.isPanning = true;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            this.container.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isPanning) return;
            this.panX = e.clientX - this.startX;
            this.panY = e.clientY - this.startY;
            this._applyTransform();
        });

        document.addEventListener('mouseup', () => {
            this.isPanning = false;
            this.container.style.cursor = 'default';
        });

        // Touch support
        let touchStartX = 0;
        let touchStartY = 0;
        let touchStartPanX = 0;
        let touchStartPanY = 0;

        this.container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                touchStartX = e.touches[0].clientX;
                touchStartY = e.touches[0].clientY;
                touchStartPanX = this.panX;
                touchStartPanY = this.panY;
            }
        });

        this.container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                e.preventDefault();
                this.panX = touchStartPanX + (e.touches[0].clientX - touchStartX);
                this.panY = touchStartPanY + (e.touches[0].clientY - touchStartY);
                this._applyTransform();
            }
        });
    }

    /**
     * Set the family tree data
     * @param {Object} data - Parsed GEDCOM data
     */
    setData(data) {
        this.data = data;
        this.individuals = new Map();
        this.families = new Map();

        for (const person of data.individuals) {
            this.individuals.set(person.id, person);
        }
        for (const family of data.families) {
            this.families.set(family.id, family);
        }

        // Find root person (person with no parents, or first person)
        this.rootId = this._findRootPerson();
        this.render();
    }

    /**
     * Find the root person for the tree
     * @returns {string|null} Root person ID
     */
    _findRootPerson() {
        // Find a person with no parents
        for (const [id, person] of this.individuals) {
            if (person.parents.length === 0) {
                return id;
            }
        }
        // Fallback to first person
        return this.individuals.size > 0 ? this.individuals.keys().next().value : null;
    }

    /**
     * Render the family tree
     */
    render() {
        if (!this.rootId || this.individuals.size === 0) {
            this.svg.innerHTML = '';
            return;
        }

        // Calculate layout
        const layout = this._calculateLayout(this.rootId);

        // Set SVG dimensions
        const padding = 50;
        const width = layout.width + padding * 2;
        const height = layout.height + padding * 2;
        this.svg.setAttribute('width', width);
        this.svg.setAttribute('height', height);
        this.svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Clear SVG
        this.svg.innerHTML = '';

        // Create SVG namespace
        const NS = 'http://www.w3.org/2000/svg';

        // Draw links
        for (const link of layout.links) {
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', link.d);
            path.setAttribute('class', `tree-link ${link.type || ''}`);
            this.svg.appendChild(path);
        }

        // Draw nodes
        for (const node of layout.nodes) {
            const person = this.individuals.get(node.id);
            if (!person) continue;

            const g = document.createElementNS(NS, 'g');
            g.setAttribute('class', 'tree-node');
            g.setAttribute('data-id', node.id);
            g.setAttribute('transform', `translate(${node.x}, ${node.y})`);

            // Node background
            const rect = document.createElementNS(NS, 'rect');
            rect.setAttribute('width', this.nodeWidth);
            rect.setAttribute('height', this.nodeHeight);
            rect.setAttribute('rx', '8');
            rect.setAttribute('ry', '8');
            rect.setAttribute('fill', this._getGenderColor(person.gender));
            rect.setAttribute('stroke', '#fff');
            rect.setAttribute('stroke-width', '2');
            g.appendChild(rect);

            // Name text
            const name = document.createElementNS(NS, 'text');
            name.setAttribute('class', 'node-name');
            name.setAttribute('x', this.nodeWidth / 2);
            name.setAttribute('y', this.nodeHeight / 2 - 5);
            name.textContent = this._truncateText(person.name, 20);
            g.appendChild(name);

            // Dates text
            const dates = document.createElementNS(NS, 'text');
            dates.setAttribute('class', 'node-dates');
            dates.setAttribute('x', this.nodeWidth / 2);
            dates.setAttribute('y', this.nodeHeight / 2 + 15);
            dates.textContent = this._formatDates(person);
            g.appendChild(dates);

            // Click handler
            g.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectPerson(node.id);
            });

            this.svg.appendChild(g);
        }

        // Update stats
        const statsEl = document.getElementById('tree-stats');
        if (statsEl) {
            statsEl.textContent = `${this.individuals.size} people • ${this.families.size} families`;
        }

        // Hide empty state
        const emptyState = document.getElementById('tree-empty');
        if (emptyState) {
            emptyState.style.display = 'none';
        }

        // Reset view
        this.resetView();
    }

    /**
     * Calculate tree layout
     * @param {string} rootId - Root person ID
     * @returns {Object} Layout with nodes and links
     */
    _calculateLayout(rootId) {
        const nodes = [];
        const links = [];
        const positions = new Map();
        const visited = new Set();

        // BFS to assign generations
        const queue = [{ id: rootId, generation: 0 }];
        const generations = new Map(); // generation -> [personIds]
        const personGen = new Map();

        while (queue.length > 0) {
            const { id, generation } = queue.shift();
            if (visited.has(id)) continue;
            visited.add(id);

            personGen.set(id, generation);
            if (!generations.has(generation)) {
                generations.set(generation, []);
            }
            generations.get(generation).push(id);

            const person = this.individuals.get(id);
            if (!person) continue;

            // Add spouse to same generation
            for (const spouseId of person.spouses) {
                if (!visited.has(spouseId)) {
                    personGen.set(spouseId, generation);
                    if (!generations.has(generation)) {
                        generations.set(generation, []);
                    }
                    generations.get(generation).push(spouseId);
                    visited.add(spouseId);
                }
            }

            // Add children to next generation
            for (const childId of person.children) {
                if (!visited.has(childId)) {
                    queue.push({ id: childId, generation: generation + 1 });
                }
            }
        }

        // Calculate positions
        const maxGen = Math.max(...Array.from(generations.keys()), 0);
        const genCounts = new Map();
        const genOffsets = new Map();

        // Calculate max width per generation
        let maxWidth = 0;
        for (const [gen, ids] of generations) {
            const width = ids.length * (this.nodeWidth + this.hGap) - this.hGap;
            maxWidth = Math.max(maxWidth, width);
            genCounts.set(gen, ids.length);
        }

        // Calculate offsets for centering
        for (const [gen, ids] of generations) {
            const totalWidth = ids.length * (this.nodeWidth + this.hGap) - this.hGap;
            genOffsets.set(gen, (maxWidth - totalWidth) / 2);
        }

        // Assign positions
        for (const [gen, ids] of generations) {
            const offset = genOffsets.get(gen) || 0;
            ids.forEach((id, index) => {
                const x = offset + index * (this.nodeWidth + this.hGap);
                const y = gen * (this.nodeHeight + this.vGap);
                positions.set(id, { x, y });
                nodes.push({ id, x, y });
            });
        }

        // Create links
        for (const [id, person] of this.individuals) {
            const pos = positions.get(id);
            if (!pos) continue;

            // Marriage links
            for (const spouseId of person.spouses) {
                const spousePos = positions.get(spouseId);
                if (spousePos && id < spouseId) {
                    const d = this._createMarriageLink(pos, spousePos);
                    links.push({ d, type: 'marriage' });
                }
            }

            // Parent-child links
            for (const childId of person.children) {
                const childPos = positions.get(childId);
                if (childPos) {
                    const d = this._createParentChildLink(pos, childPos);
                    links.push({ d });
                }
            }
        }

        const height = (maxGen + 1) * (this.nodeHeight + this.vGap) - this.vGap;

        return {
            nodes,
            links,
            width: maxWidth,
            height
        };
    }

    /**
     * Create a marriage link path
     * @param {Object} pos1 - Position of first spouse
     * @param {Object} pos2 - Position of second spouse
     * @returns {string} SVG path
     */
    _createMarriageLink(pos1, pos2) {
        const x1 = pos1.x + this.nodeWidth;
        const y1 = pos1.y + this.nodeHeight / 2;
        const x2 = pos2.x;
        const y2 = pos2.y + this.nodeHeight / 2;
        return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    /**
     * Create a parent-child link path
     * @param {Object} parentPos - Position of parent
     * @param {Object} childPos - Position of child
     * @returns {string} SVG path
     */
    _createParentChildLink(parentPos, childPos) {
        const x1 = parentPos.x + this.nodeWidth / 2;
        const y1 = parentPos.y + this.nodeHeight;
        const x2 = childPos.x + this.nodeWidth / 2;
        const y2 = childPos.y;
        const midY = (y1 + y2) / 2;
        return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
    }

    /**
     * Get color based on gender
     * @param {string} gender
     * @returns {string} Color hex
     */
    _getGenderColor(gender) {
        switch (gender) {
            case 'male': return '#4a90d9';
            case 'female': return '#e07a9e';
            default: return '#95a5a6';
        }
    }

    /**
     * Format birth-death dates
     * @param {Object} person
     * @returns {string}
     */
    _formatDates(person) {
        const birth = person.birthDate ? this._extractYear(person.birthDate) : '?';
        const death = person.deathDate ? this._extractYear(person.deathDate) : '';
        return death ? `${birth} - ${death}` : `${birth}`;
    }

    /**
     * Extract year from a date string
     * @param {string} date
     * @returns {string}
     */
    _extractYear(date) {
        const match = date.match(/\d{4}/);
        return match ? match[0] : date;
    }

    /**
     * Truncate text to max length
     * @param {string} text
     * @param {number} maxLength
     * @returns {string}
     */
    _truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Select a person and show their profile
     * @param {string} id - Person ID
     */
    selectPerson(id) {
        this.selectedId = id;
        // Highlight selected node
        const nodes = this.svg.querySelectorAll('.tree-node');
        nodes.forEach(n => n.classList.remove('selected'));
        const selected = this.svg.querySelector(`.tree-node[data-id="${id}"]`);
        if (selected) {
            selected.classList.add('selected');
        }
        // Dispatch event for app to handle
        const event = new CustomEvent('personSelected', { detail: { id } });
        document.dispatchEvent(event);
    }

    /**
     * Zoom in
     */
    zoomIn() {
        this.zoomAt(this.container.clientWidth / 2, this.container.clientHeight / 2, 0.1);
    }

    /**
     * Zoom out
     */
    zoomOut() {
        this.zoomAt(this.container.clientWidth / 2, this.container.clientHeight / 2, -0.1);
    }

    /**
     * Zoom at a specific point
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {number} delta - Zoom delta
     */
    zoomAt(x, y, delta) {
        const newZoom = Math.min(2, Math.max(0.2, this.zoom + delta));
        const ratio = newZoom / this.zoom;
        this.panX = x - (x - this.panX) * ratio;
        this.panY = y - (y - this.panY) * ratio;
        this.zoom = newZoom;
        this._applyTransform();
    }

    /**
     * Reset view
     */
    resetView() {
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this._applyTransform();
    }

    /**
     * Toggle layout direction
     */
    toggleLayout() {
        this.layout = this.layout === 'horizontal' ? 'vertical' : 'horizontal';
        this.render();
    }

    /**
     * Apply transform to SVG
     */
    _applyTransform() {
        this.svg.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    }
}

// Export for browser use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TreeRenderer;
}