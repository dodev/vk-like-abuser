const VKApi = require('node-vkapi')
const firebase = require('firebase')
const firebaseConfig = require('./firebaseConfig')

const VK_API_WAIT = 1000
const RESTART_ENGINE_TIME = 120000

let usersInstance = null
let consoleInstance = null
let dbInstance = null
let pushesInstance = null

let app = firebase.initializeApp(firebaseConfig)
let db = app.database()


class Pushes {
  constructor () {
    if (!pushesInstance) {
      this.db = db
      this.pushes = this.db.ref('/pushes')
      
      pushesInstance = this
    }
    return pushesInstance
  }

  send (msg) {
    // this.pushes.push({
    //   time: new Date().toString(),
    //   message: msg
    // })
  }
}

class Console {
  constructor (msg) {
    if (!consoleInstance) {
      this.config = {
        errors: true,
        success: true,
        notifications: true
      }

      consoleInstance = this
    }
    return consoleInstance
  }

  error (msg) {
    if (!this.config.errors)
      return false
    let message = 'Error: ' + msg
    console.log(message)
    new Pushes().send(message)
  }

  success (msg) {
    if (!this.config.success)
      return false
    let message = 'Success: ' + msg
    console.log(message)
    new Pushes().send(message)
  }

  notify (msg) {
    if (!this.config.notifications)
      return false
    let message = 'Notification: ' + msg
    console.log(message)
    new Pushes().send(message)
  }
}

class Users {
  constructor () {
    if (!usersInstance) {
      this.users = {}
      this.usersCount = 0
      this.initialized = false

      usersInstance = this
    }

    return usersInstance
  }

  initialize () {
    return new Promise ((resolve, reject) => {
      this.fetchUsers()
        .then(res => {
          this.initialized = true
          new Console().success('Class {Users} has been successfully initialized')

          resolve()
        })
        .catch(e => {
          new Console().error('{Users} Can`t be initialized')
          reject()
        })
    })
  }

  fetchUsers () {
    return new Promise((resolve, reject) => {
      new DB().getUsers()
        .then(users => {
          this.users = users
          resolve()
        })
        .catch(e => reject())
    })
  }

  showUsers () {
    for (let user in this.users) {
      console.log(this.users[user].id)
    }
  }

  findById (id) {
    if (!id) return new Console().error('{Users} [id] is not provided.')

    if (typeof this.users[id] !== 'undefined') {
      return this.users[id]
    } else {
      new Console().notify(`{Users} User with id ${id} not found`)
      return false
    }
  }

  isUserExist (id) {
    if (this.findById(id) !== false) {
      return true
    }

    return false
  }

  getUsers () {
    var userList = []
    let i = 0
    for (let user in this.users) {
      i++
      userList.push(this.users[user])
    }
    this.usersCount = i
    return userList
  }
}

class User extends Users {
  constructor ({username, id}) {
    super()
    if (!id) return new Console().error('{Users} VK [id] is not provided.')
    if (!username) return new Console().error('{Users} VK [username] is not provided')
    const user = {
      id,
      username
    }

    this.users[user.id] = user
    this.usersCount++
    new Console().success(`{Users} ${user.username} joined our club!`)

    return this.user
  }
}


class Likes {
  constructor () {
    this.likes = {

    }
  }

  add ({target, object}) {
    if (!target) return new Console().error('{Likes} target id is not provided')
    if (!object) return new Console().error('{Likes} object id is not provided')

    const like = {
      target,
      object
    }

    this.likes[target] = like
    return new Console().success('{Likes} like has been added')
  }

  showLikes () {
    console.log(this.likes)
  }
}

class Like extends Likes {
  constructor ({object, target}) {
    super()
    return new Promise ((resolve, reject) => {
      if (!object || !target) {
        new Console().error('No object or target id')
        return reject()
      }

      let user = new Users().findById(object)
      if (!user) {
        new Console().error('{Like} No user with this id')
        return reject()
      }
      
      // const types = ['post', 'photo']

      setTimeout(() => {
        const token = user.access_token
        if (!token) {
          new Console().error('{Like} NO ACCESS_TOKEN')
          return reject()
        }
        let vk = new VK(token)
        let db = new DB()
        vk.getPhotos(target).then(r => {
          console.log(r)
          const { count, items } = r
          if (count === 0) return reject()

          db.findAvailableItemToLike({
            type: 'photo',
            object,
            target,
            items: items
          }).then(id => {
            vk.like({
              target: target,
              id: id
            }).then(r => {
              db.addToLikedList({
                object: object,
                target: target,
                type: 'photo',
                id: id
              })
              new Console().success(`{Like} id${object} liked id${target}`)
              return resolve()
            }).catch(e => {
              new Console().error(`{Like} id${object} DOES NOT LIKED id${target}`)
              return reject(e)
            })
          }).catch(e => {
            new Console().error(`{Like} id${object} DOES NOT LIKED id${target}`)
            return resolve()
          })
        }).catch(e => {
          new Console().error(`{Like} can't get user ${target} vk photos`)
          return resolve()
        })
        return resolve()
      }, VK_API_WAIT)
    })
  }
}

class Groups {
  constructor () {
    this.groups = []
    this.peopleInGroup = 0
    this.groupsCount = 0

    this.splitIntoGroups()
  }

  get () {
    return this.groups
  }

  splitIntoGroups () {
    let people = new Users().getUsers()

    let peopleAmount = people.length
    this.findOptimalGroupsCount(peopleAmount)
    people = shuffleArray(people)

    for (let i = 0; i < this.groupsCount; i++) {
      this.groups.push([])
      for (let e = 0; e < this.peopleInGroup; e++) {
        this.groups[i].push(people[0])
        people.splice(0, 1)
      }
    }

    return this.groups
  }

  showGroups () {
    console.log(this.groups)
  }

  findOptimalGroupsCount (peopleAmount) {
    if (!peopleAmount) return new Console().error('Failed to split into groups')
    if (peopleAmount < 4) {
      this.peopleInGroup = peopleAmount
      this.groupsCount = 1

      return {
        peopleInGroup: peopleAmount,
        groupsCount: 1
      }
    }
    let medianArray = []
    let count = 0
    for (let i = 2; i <= peopleAmount; i++) {
      if (peopleAmount % i == 0) {
        count++
        medianArray.push(i)
      }
    }

    if (count === 0 || count === 1) {
      return this.findOptimalGroupsCount(peopleAmount - 1)
    }

    const peopleInGroup = medianArray[Math.floor(medianArray.length / 2)]
    const groupsCount = peopleAmount / peopleInGroup

    this.peopleInGroup = peopleInGroup
    this.groupsCount = groupsCount

    return {
      peopleInGroup,
      groupsCount
    }
  }
}

class Group extends Groups {
  constructor (users) {
    console.log('eeee', users)
    super()
    if (!users || users.length === 0) return new Console().error('{Groups}: No any users have been provided')
    for (let user of users) {
      if (!this.isUserExist(user.id)) return new Console().error('{Groups}: User does not exist')
    }

    this.groups.push(users)
  }
}

class Tests {
  generateRandomUsers () {
    for (let i = 1; i <= PEOPLE_AMOUNT; i++) {
      new User({
        id: i.toString(),
        username: i.toString()
      })
    }
  }
}

class VK {
  constructor (access_token) {
    if (!access_token) return new Console().error('{VK} No access token provided')
    this.vk = new VKApi({
      token: access_token
    })
  }

  getUser (user_ids) {
    return new Promise((resolve, reject) => {
      this.vk.call('users.get', {
        user_ids: user_ids,
        fields: ['photo_50', 'photo_100']
      }).then(res => {
        if (res.length > 0) res = res[0]
        return resolve(res)
      })
      .catch(e => {
        return reject(e)
      })
    })
  }

  like ({target, id, type}) {
    if (!target) return new Console().error('{VK} no target')
    if (!id) return new Console().error('{VK} no id')

    return new Promise ((resolve, reject) => {
      this.vk.call('likes.add', {
        type: 'photo',
        owner_id: target,
        item_id: id
      }).then(res => {
        console.log(res)
        return resolve()
      })
      .catch(e => {
        console.log(e)
        reject(e)
      })
    })
  }

  getWall (user_id) {

  }

  getPhotos (user_id) {
    const types = ['wall', 'profile']
    const typeToSearch = types[Math.floor(Math.random() * types.length)]

    return new Promise ((resolve, reject) => {
      if (!user_id) return reject('No user id provided')
      this.vk.call('photos.get', {
        owner_id: user_id,
        album_id: typeToSearch,
        rev: 1
      }).then(res => {
        const { count , items } = res
        if (count === 0) {
          return reject()
        }

        items.forEach((item, index, array) => {
          array[index] = item.id
        })
        return resolve(res)
      })
      .catch(e => {
        return reject(e)
      })
    })
  }
}

class Listeners {
  constructor () {
    this.listenForNewUsers()

    new DB().updateUsersInfo()
  }

  listenForNewUsers () {
    new Console().notify('{Listeners} Listening for new users..')
    let users = db.ref('users')

    users.orderByChild('createdAt').startAt(Date.now()).on('child_added', data => {

      let user = data.val()
      const { access_token, id } = user
      let vk = new VK(access_token)
      vk.getUser(id).then(_user => {
        console.log(_user)
        if (_user) {
          const { first_name, last_name, photo_100, photo_50 } = _user
          const username = `${first_name} ${last_name}`

          db.ref(`users/${id}`).update({
            username: username,
            photo_100: photo_100,
            photo_50: photo_50
          })
          new Console().success(`{Listeners} ${username} has joined`)
        }
      }).catch(e => {
          let notValid = db.ref(`users/${id}/isValid`)
          notValid.transaction(currentValue => false)
          new Console().error(`{Listeners} ${id} couldnt do authentication`)
        })
    })
  }
}

class DB {
  constructor () {
    if (!dbInstance) {
      this.app = app
      this.db = db

      new Console().success('{DB} Connection established')
      dbInstance = this
    }

    return dbInstance
  }

  updateUsersInfo () {
    let _scopeDelay = 500
    let users = db.ref('users')
    users.on('child_added', data => {
      setTimeout(() => {
        let user = data.val()
        const { access_token, id } = user
        console.log('trying ' + id)
        let vk = new VK(access_token)
        vk.getUser(id).then(_user => {
          if (_user) {
            const { first_name, last_name, photo_100, photo_50 } = _user
            const username = `${first_name} ${last_name}`

            db.ref(`users/${id}`).update({
              username: username,
              photo_100: photo_100,
              photo_50: photo_50,
              isValid: true
            })
            new Console().success(`{Listeners} ${username} has joined`)
          }
        }).catch(e => {
          let notValid = db.ref(`users/${id}/isValid`)
          notValid.transaction(currentValue => false)
          new Console().error(`{Listeners} ${id} couldnt do authentication`)
        })
      }, _scopeDelay)

      _scopeDelay += _scopeDelay
    })
  }

  getUsers () {
    return new Promise ((resolve, reject) => {
      this.db.ref('/users').once('value')
      .then(snapshot => {
        let users = snapshot.val()
        for (let userId in users) {
          let user = users[userId]
          if (user.isActive === false) {
            delete users[userId]
          }
        }
        return resolve(users)
      })
      .catch(e => reject())
    })
  }


  getUserById (id) {
    return new Promise ((resolve, reject) => {
      let user = this.db.ref(`/users/${id}`)
      user.once('value').then(r => {
        if (r.val() == null) {
          return resolve(r.val())
        }

        return reject()
      })
    })
  }

  isUserExist (id) {
    return new Promise ((resolve, reject) => {
      let user = this.db.ref(`/users/${id}`)
      user.once('value').then(r => {
        if (r.val() == null) {
          return resolve()
        }

        return reject()
      })
    })
  }

  findAvailableItemToLike ({object, target, type, items}) {
    return new Promise((resolve, reject) => {
      const alreadyLiked = this.db.ref(`/likes/${object}/${target}/${type}`)

      alreadyLiked.once('value', likes => {
        if (likes.val()) {
          const alreadyLikedList = likes.val()
          for (let availableItemId of items) {
            if (alreadyLikedList[availableItemId] === 1) {
              // In that case do nothing
            } else {
              return resolve(availableItemId)
            }
          }
        }

        return resolve(items[0])
      })
    })
  }

  addUser ({username, access_token, id}) {
    if (!username) return new Console().error('{DB} No username provided')
    if (!access_token) return new Console().error('{DB} No access token provided')
    if (!id) return new Console().error('{DB} No vk id provided')

    this.isUserExist(id)
    .then(isUserExist => {
        this.db.ref(`users/${id}`).set({
          username,
          access_token,
          id,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        }).then(r => new Console().success(`{DB} User ${username} has been added`))
      }
    ).catch(e => {
      return new Console().error('{DB} User is already exist')
    })
  }

  isInLikedList () {
    return true
  }

  addToLikedList ({object, target, type, id}) {
    if (!object) return new Console().error('{DB} No object user profided')
    if (!target) return new Console().error('{DB} No target user provided')
    if (!type) return new Console().error('{DB} No type provided')
    if (!id) return new Console().error('{DB} No id provided')

    this.db.ref(`/likes/${object}/${target}/${type}/${id}`).set(1)
    let youLiked = this.db.ref(`/statistics/${object}/you_liked`)
    youLiked.transaction(currentValue => (currentValue || 0) + 1)

    let likedYou = this.db.ref(`/statistics/${target}/liked_you`)
    likedYou.transaction(currentValue => (currentValue || 0) + 1)
  }

}

class Engine {
  constructor () {
    this.db = new DB()
    this.users = new Users()
    this.tasks = []

    if (!this.isItTimeToRunEngine()) {
      return false
    }

    this.users.initialize()
      .then(() => {
        this.groups = new Groups()

        new Console().success('{Engine} is initialized')
        this.getTasks()
        this.start()
      })
  }

  start () {
    this.getNextTask()
  }

  getTasks () {
    let groups = this.groups.get()
    for (let group of groups) {
      for (let i = 0; i < group.length; i++) {
        for (let e = 0; e < group.length; e++) {
          if (i !== e) {
            this.tasks.push({
              object: group[i].id,
              target: group[e].id
            })
          }
        }
      }
    }
  }

  getNextTask () {
    if (this.tasks.length === 0) {
      new Console().success('{Engine} All tasks are done')

    new Console().notify('{Engine} New engine cycle will be started in 30s')
      setTimeout(() => {
        new Console().notify('{Engine} New engine has been just started')
        new Engine()
      }, RESTART_ENGINE_TIME)
      return
    }
    this.doTask(this.tasks[this.tasks.length - 1]).then(() => {
      this.tasks.pop()
      this.getNextTask()
    })
  }

  doTask ({object, target}) {
    return new Promise((resolve, reject) => {
      new Like({object, target})
        .then(() => {
          resolve()
        })
        .catch(() => {
          resolve()
        })
    })
  }

  isItTimeToRunEngine () {
    const currentTime = new Date().getHours()
    if (currentTime > 2 && currentTime < 8) {
      new Console().notify('{Engine} Its not a time to run Engine')
      return false
    }
    return true
  }
}


const listeners = new Listeners()
// const engine = new Engine()

function shuffleArray (arr) {
  let i = arr.length
  while (i > 0) {
    i--
    let e = Math.floor(Math.random() * arr.length)
    let k = Math.floor(Math.random() * arr.length)

    let tmp = arr[e]
    arr[e] = arr[i]
    arr[i] = tmp

  }
  return arr
}