const nodes = []
const links = []
const usersTable = {}

users.once('value', __users => {
  likes.once('value', __likes => {
    const _users = __users.val()
    const _likes = __likes.val()

    const usersArray = Object.keys(_users)

    let usersIncrementId = 0
    let limit = 10

    for (let user in _users) {
      if (usersIncrementId > limit) {
        break
      }
      if (_users[user].id) {
        nodes.push(_users[user])
        usersTable[user] = usersIncrementId
        usersIncrementId++
      }
    }

    restart()
    setTimeout(() => {
        for (let i = 0; i < usersIncrementId; i++) {
          for (let e = 1; e < usersIncrementId; e++) {
            let source = usersTable[usersArray[i]]
            let target = usersTable[usersArray[e]]

            if (source && target) {
              addToLinks({source, target})
            }
          }
        }
    }, 500)
      
  })
})

let delayTimeout = 200
let addToLinks = obj => {
  setTimeout(() => {
    const { source, target } = obj
    if (!source || !target) {
      return false
    }
    links.push(obj)
    restart()
  }, delayTimeout)
  delayTimeout += 100
}

// users.on('child_changed', snap => {
//   let userId = snap.val().id
//   nodes[usersTable[userId]].isActive = !nodes[usersTable[userId]].isActive
//   restart()
// })


const svg = d3.select("svg#graph")

const width = window.innerWidth
const height = window.innerHeight

svg
  .attr('width', width)
  .attr('height', height)


var simulation = d3.forceSimulation(nodes)
    .force('charge', d3.forceManyBody().strength(-3000))
    .force('link', d3.forceLink(links).distance(width/Math.PI))
    .force('x', d3.forceX())
    .force('y', d3.forceY())
    .alphaTarget(1)
    .on('tick', ticked);

var g = svg.append('g')
  .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')')
let link = g.append('g')
  .attr('stroke', 'rgba(255, 255, 255, .7)')
  .attr('stroke-width', 1)
  .selectAll('.link')
let node = g.append('g')
  .attr('stroke', 'rgba(0, 0, 0, 1)')
  .attr('stroke-width', 2)
  .selectAll('.node')

const picSize = 50
const picDiff = - picSize / 2

d3.select('circle').on('click', e => {
  console.log(e)
})

function restart() {

  // Apply the general update pattern to the nodes.
  node = node.data(nodes, d => d.id)
  node.exit().remove()

  let defs = node.append('svg:defs')

  node.enter().append('svg:pattern')
    .attr('id', d => d.id)
    .attr('width', picSize)
    .attr('height', picSize)
    .attr('patternUnits', 'userSpaceOnUse')
    .append('svg:image')
    .attr('xlink:href', d => d.photo_50)
    .attr('width', picSize - 5)
    .attr('height', picSize)
    .attr('x', 0)
    .attr('y', 0)

  node = node.enter().append("circle")
    .attr('cx', picDiff)
    .attr('cy', picDiff)
    .attr('r', 16)
    .attr('stroke', d => d.isActive ? '#66bb6a' : 'white')
    .style('fill', d => {
      
      return 'green'
    })
    .style('fill', d => `url(#${d.id})`).merge(node)

  link = link.data(links, function(d) { return d.source.id + "-" + d.target.id; })
  link.exit().remove()
  link = link.enter().append("line").merge(link)

  simulation.force("link").links(links);
  simulation.nodes(nodes);
  simulation.alpha(1).restart();
}

function ticked() {
  node.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
  node.attr('x', d => d.x)
  node.attr('y', d => d.y)

  link.attr('x1', d => d.source.x + picDiff)
      .attr('y1', d => d.source.y + picDiff)
      .attr('x2', d => d.target.x + picDiff)
      .attr('y2', d => d.target.y + picDiff)
}