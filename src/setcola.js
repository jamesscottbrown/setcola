import {computeSets} from './sets.js';
import {computeConstraints} from './constraints.js';

import * as setcola from "./setcola.js";

let globalState = {};
let _nodes, _links, _sets, _gap, _guides, _guideNodes, _groups, _constraintDefs, _output;
let INDEX;

export function constraints(constraints) {
  if(constraints === undefined) {
    return _constraintDefs;
  } else {
    _constraintDefs = constraints;
    return setcola;
  }
}

export function gap(gap) {
  if(gap === undefined) {
    return _gap;
  } else {
    _gap = gap;
    return setcola;
  }
}

export function groups(groups) {
  if(groups === undefined) {
    return _groups;
  } else {
    _groups = groups;
    return setcola;
  }
}

export function guides(guides) {
  if(guides === undefined) {
    return _guides;
  } else {
    _guides = guides;
    _nodes = _nodes.filter(node => { return !node._guide; }); // Remove previous guides.
    guides.map(generateGuides);
    return setcola;
  }
}

export function links(links) {
  if(links === undefined) {
    return _links;
  } else {
    _links = links;
    _links.map(setLinkID);
    return setcola;
  }
}

export function nodes(nodes) {
  if(nodes === undefined) {
    return _nodes;
  } else {
    _nodes = nodes;
    _nodes.map(setID);
    return setcola;
  }
}

export function sets() {
  return _sets;
}

export function layout() {
  INDEX = -1;

  if(!_nodes) console.error('No graph nodes defined.');
  if(!_links) links([]);
  if(!_groups) groups([]);
  if(!_guides) guides([]);
  if(!_constraintDefs) constraints([]);
  if(!_gap) gap(20);

  // Remove previously added internal properties.
  _nodes = _nodes.filter(node => { return !node._cid; });
  _links = _links.filter(link => { return !link._cid; });
  _groups = _groups.filter(group => { return !group._cid; });

  // Compute additional graph properties as needed
  computeBuiltInProperties(_constraintDefs);

  // Generate the SetCoLa sets
  _sets = {};
  for (let i = 0; i < _constraintDefs.length; i++) {
    const result = generateSets(_constraintDefs[i]);
    _sets[result.name] = result.sets;
  }

  // Generate the WebCoLa constraints
  _constraintDefs.forEach(() => {

  });
  const webcolaConstraints = [].concat.apply([], _constraintDefs.map(generateConstraints));

  // Produce the output spec
  return {
    nodes: nodes(),
    links: links(),
    groups: groups(),
    guides: guides(),
    constraints: webcolaConstraints,
    constraintDefs: constraints()
  };
}

function generateGuides(guide) {
  const node = { 
    '_guide': true,
    '_temp': true, 
    'fixed': true, 
    'width': 1,
    'height': 1,
    'padding': 0,
    'x': Math.random()*100,
    'y': Math.random()*100,
    'boundary': ''
  };

  // Save the position information from the guide.
  let complete = false;
  if(guide.hasOwnProperty('x')) {
    node.x = guide.x;
    node.boundary += 'x';
    complete = true;
  }
  if(guide.hasOwnProperty('y')) {
    node.y = guide.y;
    node.boundary += 'y';
    complete = true;
  }
  if(!complete) {
    console.error('Guide must have an x and/or y position: ', guide);
  }

  // Save the name from the guide.
  if(guide.hasOwnProperty('name')) {
    const found = _nodes.filter(node => { return node.name === guide.name; });
    if(found.length > 0) {
      console.error(`A node with the name '${guide.name}' already exists.`);
    } else {
      node.name = guide.name;
    }
  } else {
    console.error('Guide must have a name: ', guide);
  }
  
  // Save the guide and get its index.
  _nodes.push(node);
  node._id = _nodes.indexOf(node);
  return node;
}

function generateSets(constraintDef) {
  let source = _nodes.filter(node => { return !node._temp; });
  if(constraintDef.from && typeof constraintDef.from === 'string') {
    source = _sets[constraintDef.from];
  } else if(constraintDef.from) {
    source = computeSets(_nodes, constraintDef.from, _sets);
  }
  if(!constraintDef.name) constraintDef.name = `_set${++INDEX}`;
  return {'name': constraintDef.name, 'sets': computeSets(source, constraintDef.sets, _sets)}
}

function generateConstraints(constraintDef) {
  let results = [];
  (constraintDef.forEach || []).forEach(constraint => {
    (_sets[constraintDef.name] || []).forEach(elements => {
      results = results.concat(computeConstraints(elements, constraint, constraintDef.name, _gap, nodes, links, groups));
    });    
  });
  return results;
}

/**********************************************************************/
/************************** Graph Properties **************************/
/**********************************************************************/

function computeBuiltInProperties(constraints) {
  _nodes.forEach(setID);
  _links.forEach(setLinkID);

  // Compute numeric properties for the nodes
  const hasProperty = (c, p) => { return JSON.stringify(c).indexOf(p) != -1; };
  if(hasProperty(constraints, 'depth')) {
    calculateDepths();
    _nodes.forEach(node => { delete node.visited; });
  }
  if(hasProperty(constraints, 'degree')) calculateDegree();

  // Add accessors to get properties returning graph nodes/edges
  _nodes.forEach(node => {
    node.getSources = function() { return getSources(this); };
    node.getTargets = function() { return getTargets(this); };
    node.getNeighbors = function() { return getNeighbors(this); };
    node.getIncoming = function() { return getIncoming(this); };
    node.getOutgoing = function() { return getOutgoing(this); };
    node.getEdges = function() { return getEdges(this); };
    node.getFirstChild = function() { return getFirstChild(this); } ;
  });
}

function setID(node) {
  node._id = node._id || _nodes.indexOf(node);
}

function setLinkID(link) {
  link._linkid = link._linkid || _links.indexOf(link);
}

function graphSources() {
  return _nodes.filter(node => {
    if(node.hasOwnProperty('_isSource')) return node._isSource;
    const incoming = getIncoming(node).filter(n => { return n.source !== n.target; });
    return incoming.length === 0;
  });
}

function calculateDepths() {
  const roots = graphSources();
  if(roots.length === 0 && _nodes.length !== 0) {
    console.error('No roots exist, so cannot compute node depth. Please assign a \'_isSource\' property to the root and try again.');
  }
  _nodes.forEach(getDepth);
}

function calculateDegree() {
  _nodes.forEach(node => {
    node.degree = node.degree || getDegree(node);
  });
}

// The list of nodes that have edges for which the input is the target 
// (e.g., the node's parents).
function getSources(node) {
  const incoming = getIncoming(node);
  return incoming.map(link => {
    return (typeof link.source === 'object') ? link.source : _nodes[link.source];
  });
}

// The list of nodes that have edges for which the input is the source 
// (e.g., the node's children).
function getTargets(node) {
  const outgoing = getOutgoing(node);
  return outgoing.map(link => {
    return (typeof link.target == 'object') ? link.target : _nodes[link.target];
  });
}

// The list of nodes that have edges connected to the input (e.g., the 
// node's neighbors).
function getNeighbors(node) {
  const sources = node.sources || getSources(node);
  const targets = node.targets || getTargets(node);
  return sources.concat(targets);
}

// The list of edges that have the input as the target (e.g., edges 
// connecting the node to its parents).
function getIncoming(node) {
  const index = node._id;
  return _links.filter(link => {
    const source = (typeof link.source === 'object') ? link.source._id : link.source;
    const target = (typeof link.target === 'object') ? link.target._id : link.target;
    return target == index && source !== index;
  });
}

// The list of edges that have the input as the source (e.g., edges 
// connecting the node to its children).
function getOutgoing(node) {
  const index = node._id;
  return _links.filter(link => {
    const source = (typeof link.source === 'object') ? link.source._id : link.source;
    const target = (typeof link.target === 'object') ? link.target._id : link.target;
    return source == index && target !== index; 
  });
}

// The list of edges that contain the input (e.g., edges connecting the 
// node to its neighbors).
function getEdges(node) {
  const incoming = node.incoming || getIncoming(node);
  const outgoing = node.outgoing || getOutgoing(node);
  return incoming.concat(outgoing);
}

// The number of neighbors for the current node.
function getDegree(node) {
  const incoming = node.incoming || getIncoming(node);
  const outgoing = node.outgoing || getOutgoing(node);
  return incoming.length + outgoing.length;
}

function getDepth(node) {
  if(node.hasOwnProperty('depth')) return node.depth;
  if(node.visited) console.error('Cannot compute the depth for a graph with cycles.');
  node.visited = true;
  node.depth = Math.max(0, Math.max(...getSources(node).map(getDepth)) + 1);
  return node.depth;
}

function getFirstChild(node) {
  let outgoing = node.outgoing || getOutgoing(node);
  outgoing = outgoing.sort((a, b) => { return a._id - b._id; });
  outgoing = outgoing.filter(n => { return n.target !== n.source; });
  if(outgoing.length == 0) return null;
  return _nodes[outgoing[0].target];
}
