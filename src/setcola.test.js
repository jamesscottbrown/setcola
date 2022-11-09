const setcola = require("../dist/setcola")

const getGraph = () => {
    const graph = {
        // when ordered by "order", ids are in order 0, 2, 1
        "nodes": [
            {"name": "a", "order": 1, "type": "plant", "id": 0},
            {"name": "b", "order": 3, "type": "plant", "id": 1},
            {"name": "c", "order": 2, "type": "plant", "id": 2},
            {"name": "d", "order": 2, "type": "bird", "id": 3},

        ],
        "links": [
            {"source": 0, "target": 3}
        ]
    };
    return JSON.parse(JSON.stringify(graph));
}

test("can apply an *alignment* constraint", () => {
    const graph = getGraph();

    const constraintDefinitions = [
        {
            "name": "sample",
            "forEach": [{"constraint": "align", "axis": "x"}]
        }
    ];


    const {constraints} = setcola
        .nodes(graph.nodes)        // Set the graph nodes
        .links(graph.links)        // Set the graph links
        .constraints(constraintDefinitions)  // Set the constraints
        .layout();

    expect(constraints).toEqual(
        [{
            "type": "alignment",
            "axis": "y",
            "offsets": [
                {"node": 0, "offset": 0},
                {"node": 1, "offset": 0},
                {"node": 2, "offset": 0},
                {"node": 3, "offset": 0},
            ],
            "_type": "sample_align"
        }]);
})

test("can apply a *position* constraint", () => {

    const graph = getGraph();
    const guides = [
        {"name": "plant_guide", "x": 450}
    ];


    const constraintDefinitions = [
        {
            "name": "plants",
            "sets": [{"expr": "node.type === 'plant'", "name": "plants"}],
            "forEach": [
                {"constraint": "position", "position": "right", "of": "plant_guide", "gap": 200}
            ]
        },
    ];

    const {constraints} = setcola
        .nodes(graph.nodes)        // Set the graph nodes
        .links(graph.links)        // Set the graph links
        .guides(guides)
        .constraints(constraintDefinitions)  // Set the constraints
        .layout();

    expect(constraints).toEqual(
        [
            {axis: 'x', left: 4, right: 0, gap: 200, _type: 'plants_position'},
            {axis: 'x', left: 4, right: 1, gap: 200, _type: 'plants_position'},
            {axis: 'x', left: 4, right: 2, gap: 200, _type: 'plants_position'}
        ]
    );

})

test("can apply an *order* constraint", () => {
    const graph = getGraph();

    const constraintDefinitions = [
        {
            "name": "impose_ordering",
            "sets": [{"expr": "node.type === 'plant'", "name": "plants"}],
            "forEach": [
                {"constraint": "order", "axis": "x", "by": "order", "gap": 100},
            ]
        },
    ];

    const {constraints} = setcola
        .nodes(graph.nodes)        // Set the graph nodes
        .links(graph.links)        // Set the graph links
        .constraints(constraintDefinitions)  // Set the constraints
        .layout();

    // this imposes the order (id 0) - (id 2) - (i 1)
    expect(constraints).toEqual(
        [
            {
                axis: 'x',
                left: 2,
                right: 1,
                gap: 100,
                _type: 'impose_ordering_order'
            },
            {
                axis: 'x',
                left: 0,
                right: 2,
                gap: 100,
                _type: 'impose_ordering_order'
            }
        ]
    );
})

test("can apply a *circle* constraint", () => {
    const graph = getGraph();

    const constraintDefinitions = [
        {
            "name": "circle_constraint",
            "sets": [{"expr": "node.type === 'plant'", "name": "plants"}],
            "forEach": [
                {"constraint": "circle", "around": "center", "gap": 80}
            ]
        },
    ];

    const {constraints, nodes, links} = setcola
        .nodes(graph.nodes)        // Set the graph nodes
        .links(graph.links)        // Set the graph links
        .constraints(constraintDefinitions)  // Set the constraints
        .layout();


    expect(nodes.length).toEqual(graph.nodes.length + 1);
    expect(constraints).toEqual([]);


    expect(links).toEqual([
            // pre-existing link
            {source: 0, target: 3, _linkid: 0, circle: true},

            // link between pairs of nodes to achieve equal spacing
            {
                source: 2,
                target: 0,
                length: 138.56406460551017,
                _temp: true,
                _linkid: 1
            },
            {
                source: 0,
                target: 1,
                length: 138.56406460551017,
                _temp: true,
                _linkid: 2
            },
            {
                source: 1,
                target: 2,
                length: 138.56406460551017,
                _temp: true,
                _linkid: 3
            },

            // link between nodes and center
            {source: 4, target: 0, length: 80, _temp: true, _linkid: 4},
            {source: 4, target: 1, length: 80, _temp: true, _linkid: 5},
            {source: 4, target: 2, length: 80, _temp: true, _linkid: 6}
        ]
    )
})

test("can apply a *cluster* constraint", () => {
    const graph = getGraph();

    const constraintDefinitions = [
        {
            "name": "cluster_constraints",
            "sets": [{"expr": "node.type === 'plant'", "name": "plants"}],
            "forEach": [
                {"constraint": "cluster"}
            ]
        },
    ];

    const {constraints, nodes, links} = setcola
        .nodes(graph.nodes)        // Set the graph nodes
        .links(graph.links)        // Set the graph links
        .constraints(constraintDefinitions)  // Set the constraints
        .layout();

    expect(constraints).toEqual([]);
    expect(nodes.length).toEqual(graph.nodes.length);

    expect(links).toEqual([
            {source: 0, target: 3, _linkid: 0},

            {
                source: 0,
                target: 1,
                length: 1,
                _temp: true,
                _cid: 'cluster_constraints_cluster',
                _linkid: 1
            },
            {
                source: 0,
                target: 2,
                length: 1,
                _temp: true,
                _cid: 'cluster_constraints_cluster',
                _linkid: 2
            },
            {
                source: 1,
                target: 2,
                length: 1,
                _temp: true,
                _cid: 'cluster_constraints_cluster',
                _linkid: 3
            }
        ]
    );

})

test("can apply a *hull* constraint", () => {
    const graph = getGraph();

    const constraintDefinitions = [
        {
            "name": "cluster_constraints",
            "sets": [{"expr": "node.type === 'plant'", "name": "plants"}],
            "forEach": [
                {"constraint": "hull"}
            ]
        },
    ];

    const {constraints, nodes, links, groups} = setcola
        .nodes(graph.nodes)        // Set the graph nodes
        .links(graph.links)        // Set the graph links
        .constraints(constraintDefinitions)  // Set the constraints
        .layout();

    expect(constraints).toEqual([]);
    expect(nodes.length).toEqual(graph.nodes.length);
    expect(links.length).toEqual(1);

    expect(groups[0].leaves).toEqual([0, 1, 2])


})

test("can apply a *padding* constraint", () => {
    const graph = getGraph();

    const constraintDefinitions = [
        {
            "name": "cluster_constraints",
            "sets": [{"expr": "node.type === 'plant'", "name": "plants"}],
            "forEach": [
                {"constraint": "padding", "amount": 9}
            ]
        },
    ];

    const {nodes, constraints} = setcola
        .nodes(graph.nodes)        // Set the graph nodes
        .links(graph.links)        // Set the graph links
        .constraints(constraintDefinitions)  // Set the constraints
        .layout();

    expect(constraints).toEqual([]);

    expect(nodes.map(n => ({id: n.id, pad: n.pad}))).toEqual([
        {id: 0, pad: 9},
        {id: 1, pad: 9},
        {id: 2, pad: 9},
        {id: 3, pad: undefined}

    ])
})
