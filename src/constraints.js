let _graphNodes, _graphLinks, _groups, _gap;

export function computeConstraints(elements, definition, cid, gap, graphNodes, graphLinks, graphGroups) {
  _graphNodes = graphNodes;
  _graphLinks = graphLinks;
  _groups = graphGroups; 
  _gap = gap;

  let results = [];
  const ID = cid + '_' + definition.constraint;
  switch(definition.constraint) {
    case 'align':
      results = results.concat(alignment(elements, definition, ID));
      break;
    case 'order':
      results = results.concat(orderElements(elements, definition, ID));
      break;
    case 'position':
      results = results.concat(position(elements, definition, ID));
      break;
    case 'circle':
      circle(elements, definition, ID);
      break;
    case 'hull':
      hull(elements, definition, ID);
      break;
    case 'cluster':
      cluster(elements, definition, ID);
      break;
    case 'padding':
      padding(elements, definition, ID);
      break;
    default:
      console.error('Unknown constraint type \'' + definition.type + '\'');
  };

  return results;
};

/******************** Alignment Constraints ********************/

function alignment(elements, definition, cid) {
  const nodes = elements;

  // Compute the alignment offset
  const offsets = {};
  nodes.forEach(node => {
   switch(definition.orientation) {
     case 'top':
      offsets[node._id] = node.height/2;
      break;
     case 'bottom':
      offsets[node._id] = -node.height/2;
      break;
     case 'left':
      offsets[node._id] = node.width/2;
      break;
     case 'right':
      offsets[node._id] = -node.width/2;
      break;
     default:
      offsets[node._id] = 0; 
   }
  });

  // Generate the CoLa constraints
  let results = [];
  results = results.concat(CoLaAlignment(nodes, definition.axis, offsets, cid));
  return results;
};

/********************** Order Constraints **********************/

function generateOrderFunc(definition) {
  let order;
  if(definition.hasOwnProperty('order')) {
    if(definition.hasOwnProperty('reverse') && definition.reverse) definition.order.reverse();
    order = (n1, n2) => {
      return definition.order.indexOf(n1[definition.by]) - definition.order.indexOf(n2[definition.by]);
    };
  } else if(definition.hasOwnProperty('reverse') && definition.reverse) {
    order = (n1, n2) => {
      return n1[definition.by] - n2[definition.by];
    };
  } else {
    order = (n1, n2) => {
      return n2[definition.by] - n1[definition.by];
    };
  }
  return order;
};

function orderElements(elements, definition, cid) {
  if(elements[0] instanceof Array) {
   return orderSets(elements, definition, cid);
  } else {
   return orderNodes(elements, definition, cid);
  }
};

function orderNodes(nodes, definition, cid) {
  // Sort the nodes into groups
  const order = generateOrderFunc(definition);
  nodes = nodes.sort(order);

  // Generate the CoLa constraints
  const results = [];
  const axis = definition.axis;
  const gap = definition.gap ? definition.gap : _gap;
  for(let i=0; i<nodes.length-1; i++) {
    const left = nodes[i+1];
    const right = nodes[i];
    results.push(CoLaPosition(left, right, axis, cid, gap));
  };
  return results;
};

function orderSets(elements, definition, cid) {
  // Sort the elements into groups
  const order = generateOrderFunc(definition);
  elements = elements.sort(order);

  // Compute the band for the nodes
  let upperbound, offset, leftOffset, rightOffset, fixed;
  if(definition.band) {
    upperbound = elements.length;
    offset = definition.band;
    leftOffset = 0;
    rightOffset = 1;
    fixed = true;
  } else {
    upperbound = elements.length-2;
    offset = _gap;
    leftOffset = -1;
    rightOffset = 0;
    fixed = true;
  }

  // Create a new node at the barrier of each band
  const barriers = [];
  const nodeSize = 1;
  const prev = 0;
  for(let i = 0; i <= upperbound; i++) {
    const node = {
      '_cid': cid,
      '_temp': true, 
      'fixed': fixed, 
      'width': nodeSize,
      'height': nodeSize,
      'padding': 0
    };
    node.name = cid + '_boundary_' + i;

    const tempOffset = _graphNodes().filter(node => { return node._temp; }).length;

    const other = definition.axis == 'x' ? 'y' : 'x';
    node.boundary = definition.axis;
    if(definition.band) {
      node[definition.axis] = i*offset;
    } else {
      const offsetTest = (Math.sqrt(elements[i+1].length) + 2) * elements[i+1][0].size + prev;
      node[definition.axis] = i*offset;
    }
    node[other] = tempOffset*nodeSize*10;
    
    barriers.push(node);
    _graphNodes(_graphNodes().concat([node]));
  };

  // Compute the constraints to order the nodes
  const results = [];
  elements.forEach((set, index) => {
    const left = barriers[index+leftOffset];
    const right = barriers[index+rightOffset];
    const gap = definition.gap ? definition.gap : _gap;

    // Flatten the sets to get to the base nodes.
    const nodes = [].concat.apply([], set);
    nodes.forEach(node => {
      if(definition.hasOwnProperty('band') || index != 0) {
        results.push(CoLaPosition(left, node, definition.axis, cid, gap));
      }
      if(definition.hasOwnProperty('band') || index != elements.length-1) {
        results.push(CoLaPosition(node, right, definition.axis, cid, gap));
      }
    });
  });

  return results;
};

function boundaryConstraints(boundaries, definition, cid) {
  const id = cid + '_boundaryDistance';
  const c = [];
  boundaries.forEach((boundary, index) => {

    for (let i = index+1; i < boundaries.length; i++) {
      const left = boundaries[index];
      const right = boundaries[i];
      const axis = definition.axis;
      const gap = definition.gap * (i - index);
      const newConstraint = CoLaPosition(left, right, axis, id, gap);
      newConstraint.equality = true;
      if(definition.band) {
        newConstraint.gap = definition.band
      }
      c.push(newConstraint);
    }

  });
  return c;
};

/********************* Position Constraints ********************/

function position(elements, definition, cid) {
  let nodes;
  if(elements[0] instanceof Array) {
    nodes = [].concat.apply([], elements);
  } else {
    nodes = elements;
  }

  // Get the guide the elements are positioned relative to.
  const guide = _graphNodes().filter(node => {
    return node.name === definition.of && node._guide;
  })[0];

  // Create the position constraints relative to the temp node
  const results = [];
  const gap = definition.gap || _gap;
  for(let i=0; i<nodes.length; i++) {
    switch(definition.position) {
      case 'left':
        results.push(CoLaPosition(nodes[i], guide, 'x', cid, gap));
        break;
      case 'right':
        results.push(CoLaPosition(guide, nodes[i], 'x', cid, gap));
        break;
      case 'above':
        results.push(CoLaPosition(nodes[i], guide, 'y', cid, gap));
        break;
      case 'below':
        results.push(CoLaPosition(guide, nodes[i], 'y', cid, gap));
        break;
      default:
        console.error('Unknown position: \'' + definition.position + '\'');
    };
  };

  return results;
};

/********************** Circle Constraints *********************/

function circle(elements, definition, cid) {
  const nodes = elements;

  // Constants for computing edge length
  const gap = definition.gap || _gap;
  const angle = 360/nodes.length;
  const edge = Math.sqrt(2*(gap**2) - 2*(gap**2)*Math.cos(angle/180*Math.PI));

  // Label links that have at least one node in the circle layout
  _graphLinks().forEach(link => {
    const source = _graphNodes()[link.source];
    const target = _graphNodes()[link.target];
    if(nodes.indexOf(source) != -1 || nodes.indexOf(target) != -1) {
      link.circle = true;
    }
  });

  // Create links for every node in the circle
  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    const index = i==0 ? nodes.length - 1 : i-1;
    const node = _graphNodes().indexOf(nodes[index]);
    const next = _graphNodes().indexOf(nodes[i]);
    links.push({'source': node, 'target': next, 'length': edge, '_temp': true});
  };

  // Create or extract the center point.
  let center;
  switch(definition.around) {
    case 'center':
      center = {'name': cid + '_center', '_temp': true, '_cid': cid};
      _graphNodes(_graphNodes().concat([center]));
      break;
    default:
      console.error('Missing or unknown center point for the circle constraint.');
  }

  // Create a new link from the center to all nodes in the circle
  nodes.forEach(node => {
    links.push({'source': center._id, 'target': node._id, 'length': gap, '_temp': true});
  });
  _graphLinks(_graphLinks().concat(links));
};

/*********************** Hull Constraints **********************/

function hull(elements, definition, cid) {
  const nodes = elements;

  const ids = nodes.map(node => { return node._id; });
  const group = {'leaves': ids, '_cid': cid};
  if(definition.style) group.style = definition.style;
  _groups(_groups().concat([group]));
};

/********************* Cluster Constraints *********************/

function cluster(elements, definition, cid) {
  const nodes = elements;

  nodes.forEach((node, index) => {
    for (let i = index+1; i < nodes.length; i++) {
      _graphLinks(_graphLinks().concat([{
        'source': node._id, 
        'target': nodes[i]._id, 
        'length': 1,
        '_temp': true,
        '_cid': cid
      }]));
    }
  });
};

/********************* Padding Constraints *********************/

function padding(elements, definition, cid) {
  const nodes = elements;

  nodes.forEach(node => {
    node.pad = definition.amount;
    node.cid = definition.cid;
    node.spacing = true;
  });

};

/****************** Generate CoLa Constraints ******************/

function CoLaAlignment(nodes, axis, offsets, cid) {
  const constraint = {
    'type': 'alignment',
    'axis': (axis == 'x') ? 'y' : 'x',
    'offsets': [],
    '_type': cid
  };
  nodes.forEach(node => {
    constraint.offsets.push({'node': node._id, 'offset': offsets[node._id]});
  });
  return constraint;
};

function CoLaPosition(left, right, axis, cid, gap) {
  const constraint = {
    'axis': axis,
    'left': left._id,
    'right': right._id,
    'gap': gap,
    '_type': cid
  };
  return constraint;
};