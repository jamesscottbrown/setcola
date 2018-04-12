function createSet(elements, definition) {
  if(renderer.options['debugprint']) console.log('    Create set ', definition, '...');

  elements = elements.filter(function(element) { return !element.temp; });

  // Process the new set.
  var set = [];
  if(!definition) {
    set = [elements];
  } else if(definition.partition) {
    set = partitionSet(elements, definition);
  } else if(definition.collect) {
    set = collectSet(elements, definition);
  } else if(definition.expr) {
    set = exprSet(elements, definition);
    if(definition.name) set._setName = definition.name;
  } else if(typeof(definition) === 'string') {
    set = existingSet(elements, definition);
    set._setName = definition;
  } else {
    definition.forEach(function(subdef, index) {
      set.push(createSet(elements, subdef, index));
    });
  }

  return set;
};

function partitionSet(elements, definition) {
  var partitionSets = {};

  // Split the elements into sets based on their partition property.
  elements.forEach(function(element) {
    var partitionValue = element[definition.partition];
    if(definition.partition === 'parent' && partitionValue) {
      partitionValue = partitionValue._id; 
    }
    if(definition.ignore && contains(definition.ignore, partitionValue)) return;
    if(definition.include && !contains(definition.include, partitionValue)) return;
    if(!partitionSets[partitionValue]) partitionSets[partitionValue] = [];
    partitionSets[partitionValue].push(element);
  });

  // Lift the partition property to a property of the set.
  Object.keys(partitionSets).forEach(function(setName) {
    partitionSets[setName][definition.partition] = partitionSets[setName][0][definition.partition];
  });

  return Object.keys(partitionSets).map(function(setName) { 
    partitionSets[setName]._setName = setName;
    return partitionSets[setName]; 
  });
};

function collectSet(elements, definition) {
  var collectSets = {};
  elements.forEach(function(element) {
    var set = [];
    definition.collect.forEach(function(expr) {
      switch(expr) {
        case 'node':
          set.push(element);
          break;
        case 'node.firstchild':
          if(element.firstchild) set = set.concat(element.firstchild);
          break;
        case 'node.children':
          set = set.concat(element.children);
          break;
        case 'node.neighbors':
          var neighbors = element.neighbors.map(function(id) {
            return graph.spec.nodes[id];
          });
          set = set.concat(neighbors);
          break;
        case 'node.incoming':
          set = set.concat(element.incoming);
          break;
        case 'node.outgoing':
          set = set.concat(element.outgoing);
          break;
        default:
          if(expr.indexOf('sort') !== -1) {
           
            var children = element.outgoing.map(function(link) {
              return graph.spec.nodes[link.target];
            });
            var map = children.map(function(el) { return el.value; });
            var sorted = map.sort();
            var first = children.filter(function(el) {
              return el.value === sorted[0];
            });
            if(first[0]) set = set.concat(first[0]);
          
          } else if(expr.indexOf('min') !== -1) {
          
            var source = expr.split(/\(|,|\)/g)[2];
            var property = expr.split(/\(|,|\)/g)[1].replace(/'/g, '');

            var node;
            switch(source) {
              case 'node.children':
                var children = element.outgoing.filter(function(link) { 
                  return link.source !== link.target; 
                }).map(function(link) {
                  return graph.spec.nodes[link.target];
                });
                var minimum = Math.min.apply(null, children.map(function(n) { return n[property]; }));
                node = children.filter(function(n) { return n[property] === minimum; })[0];
                if(!element[property]) {
                  // Do nothing....
                } else if(node && node[property] < element[property]) {
                  node = null;
                }
                break;
              case 'node.neighbors':
                break;
              case 'node.parents':
                break;
              default:
                // Do nothing
            }
            if(node) {
              set = set.concat(node);
            }

          } else {
            console.error('Unknown collection parameter \'' + expr + '\'');
          }
      }
    });
    if(set.length > 1) collectSets[element._id] = set;
  });
  return Object.keys(collectSets).map(function(setName) { return collectSets[setName]; });
};

function exprSet(elements, definition, index) {
  var set = [];
  elements.forEach(function(element) {
    var matches = definition.expr.match(/node\.[a-zA-Z.0-9]+/g);
    var expr = definition.expr;
    matches.forEach(function(match) {
      var props = match.replace('node.', '').split('.');
      var result;
      for (var i = 0; i < props.length; i++) {
        result = element[props[i]];
      }
      expr = expr.replace(match, JSON.stringify(result));
    });
    if(eval(expr)) set.push(element);
  });

  set._exprIndex = index;
  return set;
};

function existingSet(elements, definition) {
  return layout.sets[definition];
};