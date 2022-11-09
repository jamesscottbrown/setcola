let _sets;

export function computeSets(elements, definition, sets, index) {
  _sets = sets;
  let set = [];
  if(!definition) {
    set = [elements];
  } else if(definition.partition) {
    set = partitionSet(elements, definition);
  } else if(definition.collect) {
    set = collectSet(elements, definition);
  } else if(definition.expr) {
    set = exprSet(elements, definition, index);
    if(definition.name) set._setName = definition.name;
  } else if(typeof(definition) === 'string') {
    set = existingSet(elements, definition);
    set._setName = definition;
  } else {
    definition.forEach((subdef, index) => {
      set.push(computeSets(elements, subdef, _sets, index));
    });
  }
  return set;
}

function contains(list, value) {
  return list.indexOf(value) !== -1;
}

function partitionSet(elements, definition) {
  const partitionSets = {};

  // Split the elements into sets based on their partition property.
  elements.forEach(element => {
    let partitionValue = element[definition.partition];
    if(definition.partition === 'parent' && partitionValue) {
      partitionValue = partitionValue._id; 
    }
    if(definition.exclude && contains(definition.exclude, partitionValue)) return;
    if(definition.include && !contains(definition.include, partitionValue)) return;
    if(!partitionSets[partitionValue]) partitionSets[partitionValue] = [];
    partitionSets[partitionValue].push(element);
  });

  // Lift the partition property to a property of the set.
  Object.keys(partitionSets).forEach(setName => {
    partitionSets[setName][definition.partition] = partitionSets[setName][0][definition.partition];
  });

  return Object.keys(partitionSets).map(setName => { 
    partitionSets[setName]._setName = setName;
    return partitionSets[setName]; 
  });
}

function collectSet(elements, definition) {
  const collectSets = {};
  elements.forEach(element => {
    let set = [];
    definition.collect.forEach(expr => {
      switch(expr) {
        case 'node':
          set.push(element);
          break;
        case 'node.firstchild':
          if(element.firstchild) set = set.concat(element.firstchild);
          break;
        case 'node.sources':
          set = set.concat(element.getSources());
          break;
        case 'node.targets':
          set = set.concat(element.getTargets());
          break;
        case 'node.neighbors':
          set = set.concat(element.getNeighbors());
          break;
        default:
          if(expr.indexOf('sort') !== -1) {
           
            let children = element.getTargets();
            const map = children.map(el => { return el.value; });
            const sorted = map.sort();
            const first = children.filter(el => {
              return el.value === sorted[0];
            });
            if(first[0]) set = set.concat(first[0]);
          
          } else if(expr.indexOf('min') !== -1) {
          
            const source = expr.split(/[(,)]/g)[2];
            const property = expr.split(/[(,)]/g)[1].replace(/'/g, '');

            let node;
            switch(source) {
              case 'node.children':
                let children = element.getTargets();
                const minimum = Math.min.apply(null, children.map(n => { return n[property]; }));
                node = children.filter(n => { return n[property] === minimum; })[0];
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
            console.error(`Unknown collection parameter '${expr}'`);
          }
      }
    });
    if(set.length > 1) collectSets[element._id] = set;
  });
  return Object.keys(collectSets).map(setName => { return collectSets[setName]; });
}

function exprSet(elements, definition, index) {
  const set = [];
  elements.forEach(element => {
    const matches = definition.expr.match(/node\.[a-zA-Z.0-9]+/g);
    let expr = definition.expr;
    matches.forEach(match => {
      const props = match.replace('node.', '').split('.');
      let result;
      for (let i = 0; i < props.length; i++) {
        result = element[props[i]];
      }
      expr = expr.replace(match, JSON.stringify(result));
    });
    if(eval(expr)) set.push(element);
  });
  set._exprIndex = index;
  return set;
}

function existingSet(elements, definition) {
  return _sets[definition];
}