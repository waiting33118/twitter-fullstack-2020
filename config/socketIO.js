module.exports = (server) => {
  const io = require('socket.io')(server)
  const connections = []
  let userList = []

  io.on('connection', socket => {
    socket.on('login', (user) => {
      user.socketId = socket.id
      userList.push(user)
      io.emit('onlineInfo', userList)
      io.emit('joinMsg', `${user.name}`)
    })

    socket.on('send', (msg) => {
      io.emit('showMsg', msg)
    })

    socket.on('disconnect', () => {
      userList = userList.filter(user => user.socketId !== socket.id)
      socket.broadcast.emit('OnlineInfo', userList)
    })
  })
}

