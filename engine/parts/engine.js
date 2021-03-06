const DB = require('./db')
const Console = require('./console')
const Users = require('./users')
const Like = require('./like')
const GlobalStats = require('./globalStats')

const algorithms = require('../algorithms')
const SITUATIONS = require('../config').SITUATIONS
const RESTART_ENGINE_TIME = 60000

class Engine {
  constructor (config) {
    this.situation = null
    this.target = null

    if (config) {
      const { situation, target } = config
      if (situation.length > 0) {
        this.situation = config.situation
        this.target = config.target
      }
    } else {
      this.situation = SITUATIONS.DEFAULT
    }

    this.db = new DB()
    this.users = new Users()
    this.globalStats = new GlobalStats()
    this.tasks = []

    this.success = 0
    this.errors = 0

    this.startTime = new Date()
    this.stopTime = new Date()

    if (!this.isItTimeToRunEngine()) {
      return false
    }

    this.users.initialize()
      .then(() => {
        this.getTasks()
        new Console().success(`{Engine} for 
          ${this.users.getUsers().length} people and 
          ${this.tasks.length} tasks.
        `)
        this.start()
      })
  }

  start () {
    this.getNextTask()
    this.startTime = new Date()
  }

  complete () {
    this.globalStats.incrementEnginesCount()

    this.stopTime = new Date()

    const timePassed = ((this.stopTime - this.startTime) / 1000 / 60).toFixed(2)

    new Console().success(`{Engine} All tasks are done for ${timePassed} minutes:
          ${this.success} success,
          ${this.errors} errors`)

    if (this.situation === SITUATIONS.FAST_TO_TARGET ||
        this.situation === SITUATIONS.FAST_FROM_TARGET) {
      return false
    }

    new Console().notify('{Engine} New engine cycle will be started in 30s')
    setTimeout(() => {
      new Console().notify('{Engine} New engine has been just started')
      return new Engine()
    }, RESTART_ENGINE_TIME)
    return
  }

  getTasks () {
    new Console().notify(`{Engine} Current Situation >>> «${this.situation}»`)
    switch (this.situation) {
      case SITUATIONS.DEFAULT:
        new Console().notify(`{Engine} Choosing Queue Algorithm`)
        this.tasks = new algorithms.Queue()
        break
      case SITUATIONS.FAST_TO_TARGET:
        if (this.target) {
          new Console().notify(`{Engine} Choosing Fast To Target Algorithm`)
          this.tasks = new algorithms.FastToTarget({
            target: this.target
          })
        }
        break
      case SITUATIONS.FAST_FROM_TARGET:
        if (this.target) {
          new Console().notify(`{Engine} Fast from target`)
          this.tasks = new algorithms.FastFromTarget({
            target: this.target
          })
          console.log(this.tasks)
        }
        break
      default:
        new Console().notify(`{Engine} Choosing Queue Algorithm`)
        this.tasks = new algorithms.Queue()
        break
    }
  }

  getNextTask () {
    if (this.tasks.length === 0) {
      return this.complete()
    }
    this.doTask(this.tasks[0]).then(() => {
      this.tasks.shift()
      this.getNextTask()
    })
  }

  doTask ({object, target}) {
    return new Promise((resolve, reject) => {
      new Like({object, target})
        .then(() => {
          this.globalStats.incrementLikesCount()
          this.success++
          return resolve()
        })
        .catch((e) => {
          this.errors++
          return resolve()
        })
    })
  }

  isItTimeToRunEngine () {
    const currentTime = new Date().getHours()

    if (currentTime >= 2 && currentTime < 8) {
      new Console().notify('{Engine} Its not a time to run Engine yet!')
      new Console().notify('{Engine} Will try to run engine in 1 hour!')

      if (this.situation === SITUATIONS.DEFAULT) {
        setTimeout(() => {
          new Engine()
        }, 1000 * 60 * 60)
      }

      return false
    }

    return true
  }
}

module.exports = Engine