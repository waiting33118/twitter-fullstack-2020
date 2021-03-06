const bcrypt = require('bcryptjs')
const { Sequelize } = require('../models')
const { or, not } = Sequelize.Op
const db = require('../models')
const helpers = require('../_helpers')
const User = db.User
const Tweet = db.Tweet
const Reply = db.Reply
const Like = db.Like
const Message = db.Message
const Followship = db.Followship
const imgur = require('imgur-node-api')

const userController = {
  getRecommendedUsers: (req, res, next) => {
    User.findAll({
      include: [{ model: User, as: 'Followers' }]
    })
      .then((users) => {
        users = users.map((user) => ({
          ...user.dataValues,
          followerCount: user.Followers.length,
          isFollowed: user.Followers.map((er) => er.id).includes(helpers.getUser(req).id)
        }))
        // 去除掉自己和root，依照追蹤人數多排到少，再取前10名顯示
        users = users.filter((user) => (user.name !== helpers.getUser(req).name && user.role === 'user'))
        users = users
          .sort((a, b) => b.followerCount - a.followerCount)
          .slice(0, 10)
        res.locals.recommendedUsers = users
        return next()
      })
      .catch(() => {
        res.locals.recommendedUsers = null
        return next()
      })
  },
  getUser: (req, res) => {
    return User.findByPk(req.params.id, {
      include: [
        {
          model: Tweet,
          include: [Like]
        },
        { model: User, as: 'Followers' }
      ],
      order: [[Tweet, 'createdAt', 'DESC']]
    })
      .then((user) => {
        return Like.findAll({ where: { UserId: helpers.getUser(req).id }, raw: true, nest: true })
          .then((likes) => {
            const results = user.toJSON()
            likes = likes.map(like => like.TweetId)
            results.Tweets.forEach(tweet => {
              tweet.tweetIsLiked = likes.includes(tweet.id)
            })
            results.tweetCount = results.Tweets.length
            results.isFollowed = user.Followers.map((er) => er.id).includes(helpers.getUser(req).id)
            return res.render('userPage', {
              results: results,
              currentId: helpers.getUser(req).id
            })
          })
      })
      .catch((err) => res.send(err))
  },
  getUserLikeContent: (req, res) => {
    return User.findByPk(req.params.id, {
      include: [
        {
          model: Like,
          include: [{ model: Tweet, include: User }]
        },
        { model: Tweet },
        { model: User, as: 'Followers' }
      ]
    })
      .then((user) => {
        const results = user.toJSON()
        // 有可能會抓到喜歡的reply 或 secondReply ，所以要過濾。
        results.Likes = results.Likes.filter(like => like.TweetId !== 0)
        results.isFollowed = results.Followers.map((er) => er.id).includes(helpers.getUser(req).id)
        results.tweetCount = results.Tweets.length

        results.Likes.sort((a, b) => b.createdAt - a.createdAt)
        return res.render('userLikeContent', {
          results: results,
          currentId: helpers.getUser(req).id
        })
      })
  },
  getUserRepliesTweets: (req, res) => {
    return User.findByPk(req.params.id, {
      include: [
        {
          model: Reply,
          include: { model: Tweet, include: User }
        },
        { model: Tweet },
        { model: User, as: 'Followers' }
      ],
      order: [[Reply, 'createdAt', 'DESC']]
    })
      .then((user) => {
        const results = user.toJSON()
        results.tweetCount = results.Tweets.length
        results.isFollowed = results.Followers.map((er) => er.id).includes(helpers.getUser(req).id)

        Like.findAll({ where: { UserId: helpers.getUser(req).id }, raw: true, nest: true })
          .then((likes) => {
            likes = likes.map(like => like.TweetId)
            results.Replies.forEach(reply => {
              reply.Tweet.tweetIsLiked = likes.includes(reply.Tweet.id)
            })
            return res.render('userReplyTweet', { results: results, currentId: helpers.getUser(req).id })
          })
      })
  },
  editUser: (req, res) => {
    if (Number(req.params.id) !== helpers.getUser(req).id) {
      req.flash(
        'error_messages',
        'error'
      )
      return res.redirect('back')
    }
    return User.findByPk(req.params.id).then((user) => {
      user = user.toJSON()
      return res.render('userPage', user)
    })
  },
  putUser: (req, res) => {
    if (!req.body.name) {
      req.flash('error_message', "name didn't exist")
      return res.redirect('back')
    }
    const uploadImg = (filePath) => {
      return new Promise((resolve, reject) => {
        imgur.setClientID(process.env.IMGUR_CLIENT_ID)
        if (filePath) {
          imgur.upload(filePath, (err, img) => {
            if (err) reject(err)
            resolve(img)
          })
        } else {
          reject(Error, 'file doesn\'t exist.')
        }
      })
    }
    const { files } = req
    if ((Object.keys(files).length === 0)) {
      return User.findByPk(req.params.id).then((user) => {
        user
          .update({
            name: req.body.name,
            introduction: req.body.introduction,
            cover: user.cover,
            avatar: user.avatar
          })
          .then((user) => {
            req.flash('success_message', 'user was successfully to update')
            res.redirect(`/users/${req.params.id}/tweets`)
          })
      })
    } else if ((Object.keys(files).length === 2)) {
      uploadImg(files.cover[0].path).then((cover) => {
        uploadImg(files.avatar[0].path).then((avatar) => {
          return User.findByPk(req.params.id).then((user) => {
            user.update({
              name: req.body.name,
              introduction: req.body.introduction,
              cover: cover.data.link,
              avatar: avatar.data.link
            })
          })
        })
      })
        .then(() => {
          req.flash('success_message', 'user was successfully to update')
          res.redirect(`/users/${req.params.id}/tweets`)
        })
    } else {
      if (files.cover) {
        uploadImg(files.cover[0].path).then((cover) => {
          return User.findByPk(req.params.id).then((user) => {
            user.update({
              name: req.body.name,
              introduction: req.body.introduction,
              cover: cover.data.link,
              avatar: user.avatar
            })
          })
        })
          .then(() => {
            req.flash('success_message', 'user was successfully to update')
            res.redirect(`/users/${req.params.id}/tweets`)
          })
      }
      if (files.avatar) {
        uploadImg(files.avatar[0].path).then((avatar) => {
          return User.findByPk(req.params.id).then((user) => {
            user.update({
              name: req.body.name,
              introduction: req.body.introduction,
              cover: user.cover,
              avatar: avatar.data.link
            })
          })
        })
          .then(() => {
            req.flash('success_message', 'user was successfully to update')
            res.redirect(`/users/${req.params.id}/tweets`)
          })
      }
    }
  },
  getUserFollowerList: (req, res) => {
    return User.findByPk(req.params.id, {
      include: [{ model: User, as: 'Followers' }, { model: Tweet }]
    }).then((user) => {
      user.update({ followerCount: user.Followers.length })
      const results = user.toJSON()
      results.Followers = user.Followers.map((follower) => ({
        ...follower.dataValues,
        isFollowed: helpers.getUser(req).Followings.map((er) => er.id).includes(
          follower.id
        )
      }))
      results.tweetCount = user.Tweets.length
      results.Followers.sort((a, b) => b.Followship.createdAt - a.Followship.createdAt)
      res.render('userFollowPage', { results: results })
    })
      .catch((err) => res.send(err))
  },
  getUserFollowingList: (req, res) => {
    return User.findByPk(req.params.id, {
      include: [{ model: User, as: 'Followings' }, { model: Tweet }]
    })
      .then((user) => {
        user.update({ followingCount: user.Followings.length })
        const results = user.toJSON()
        results.Followings = user.Followings.map((following) => ({
          ...following.dataValues,
          isFollowed: helpers.getUser(req).Followings.map((er) => er.id).includes(
            following.id
          )
        }))
        results.tweetCount = user.Tweets.length
        results.Followings.sort((a, b) => b.Followship.createdAt - a.Followship.createdAt)
        res.render('userFollowingPage', { results: results })
      })
      .catch((err) => res.send(err))
  },
  addFollowing: (req, res) => {
    if (helpers.getUser(req).id === Number(req.body.id)) {
      req.flash('error_messages', '無法追蹤自己')
      return res.redirect('back')
    }
    return Followship.create({
      followerId: helpers.getUser(req).id,
      followingId: req.body.id
    })
      .then(() => {
        User.findByPk(helpers.getUser(req).id).then((user) => {
          user.increment('followingCount')
        })
      })
      .then(() => {
        User.findByPk(Number(req.body.id)).then((user) => {
          user.increment('followerCount')
        })
      })
      .then(() => res.redirect('back'))
      .catch((err) => res.send(err))
  },
  removeFollowing: (req, res) => {
    return Followship.findOne({
      where: { followerId: helpers.getUser(req).id, followingId: Number(req.params.userId) }
    })
      .then((followship) => {
        followship.destroy()
      })
      .then(() => {
        User.findByPk(helpers.getUser(req).id).then((user) => {
          user.decrement('followingCount')
        })
      })
      .then(() => {
        User.findByPk(req.params.userId).then((user) => {
          user.decrement('followerCount')
        })
      })
      .then(() => res.redirect('back'))
      .catch((err) => res.send(err))
  },
  userSigninPage: (req, res) => {
    res.render('userSigninPage')
  },
  userSignupPage: (req, res) => {
    res.render('userSignupPage')
  },
  // 使用者進入passport前檢查關卡
  userCheckRequired: (req, res, next) => {
    const { email, password } = req.body
    if (!email || !password) {
      req.flash('error_messages', '請輸入帳號密碼！')
      return res.redirect('/signin')
    }
    return next()
  },
  // 使用者成功登入後訊息提示
  userSigninSuccess: (req, res) => {
    req.flash('success_messages', '登入成功！')
    res.redirect('/tweets')
  },
  userSignup: (req, res) => {
    const { account, name, email, password, checkPassword } = req.body
    // 必填檢查
    if (!account || !name || !email || !password || !checkPassword) {
      return res.render('userSignupPage', {
        account,
        name,
        email,
        error_messages: '別偷懶~全部欄位均為必填呦！'
      }) // 密碼因安全性問題，要重新填寫
    }
    // 密碼 & 確認密碼檢查
    if (password !== checkPassword) {
      return res.render('userSignupPage', {
        account,
        name,
        email,
        error_messages: '密碼與確認密碼不符，請重新確認！'
      })
    }
    // 檢查 account & email 是否為唯一值
    User.findOne({ where: { [or]: [{ account }, { email }] }, raw: true })
      .then((user) => {
        if (!user) {
          return User.create({
            account,
            name,
            email,
            password: bcrypt.hashSync(password, bcrypt.genSaltSync(10)),
            avatar: 'https://image.flaticon.com/icons/svg/2948/2948062.svg',
            cover: 'https://images.unsplash.com/photo-1570654230464-9cf6d6f0660f?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=crop&w=1950&q=80',
            introduction: `Hi Guys,I'm ${name},nice to meet you!`,
            role: 'user'
          })
            .then(() => {
              req.flash('success_messages', '已成功註冊，請登入！')
              res.redirect('/signin')
            })
            .catch((err) => res.send(err))
        }
        if (user.account === account) {
          return res.render('userSignupPage', {
            account,
            name,
            email,
            error_messages: '帳號已存在，請更改成其他帳號！'
          })
        }
        if (user.email === email) {
          return res.render('userSignupPage', {
            account,
            name,
            email,
            error_messages: 'Email已存在，請更改成其他Email！'
          })
        }
      })
      .catch((err) => res.send(err))
  },
  accountSettingPage: (req, res) => {
    res.render('accountSettingPage')
  },
  accountSetting: (req, res) => {
    const { account, name, email, password, checkPassword } = req.body
    const { id } = helpers.getUser(req)
    const loginAccount = helpers.getUser(req).account
    const loginEmail = helpers.getUser(req).email
    // hoisting issue
    const updateAccount = () => {
      User.findByPk(id)
        .then((user) =>
          user.update({
            account,
            name,
            email
          })
        )
        .then(() => {
          req.flash('success_messages', '成功修改帳戶設定！')
          res.redirect('/setting')
        })
        .catch((err) => console.log(err))
    }
    const updateAccountAndPassword = () => {
      User.findByPk(id)
        .then((user) =>
          user.update({
            account,
            name,
            email,
            password: bcrypt.hashSync(password, bcrypt.genSaltSync(10))
          })
        )
        .then(() => {
          req.flash('success_messages', '成功修改帳戶設定！')
          res.redirect('/setting')
        })
        .catch((err) => console.log(err))
    }

    // 檢查必填
    if (!account || !name || !email) {
      req.flash('error_messages', '請填寫必填項目:帳戶、名稱、E-mail')
      return res.redirect('/setting')
    }
    // 不更改密碼的情況
    if (!password && !checkPassword) {
      return findExistUser(updateAccount)
    }
    // 更改密碼，但缺其中一個
    if (!password || !checkPassword) {
      req.flash('error_messages', '欲更改密碼，請填入新密碼與確認新密碼！')
      return res.redirect('/setting')
    }
    // 密碼不相符
    if (password !== checkPassword) {
      req.flash('error_messages', '新密碼與確認新密碼不符，請重新確認！')
      return res.redirect('/setting')
    }
    findExistUser(updateAccountAndPassword)

    function findExistUser(updateMethod) {
      User.findOne({
        // 除了當前使用者的資料以外，有沒有重複的
        where: {
          [not]: [{ account: loginAccount }, { email: loginEmail }],
          [or]: [{ account: account }, { email: email }]
        }
      })
        .then(user => {
          if (!user) return updateMethod()
          if (user.account === account) {
            req.flash('error_messages', '帳號已存在，請更改成其他帳號！')
            return res.redirect('/setting')
          }
          if (user.email === email) {
            req.flash('error_messages', 'Email已存在，請更改成其他Email！')
            return res.redirect('/setting')
          }
        })
        .catch(err => console.log(err))
    }
  },
  signout: (req, res) => {
    req.logout()
    req.flash('success_messages', '已成功登出！')
    res.redirect('/signin')
  },
  chatroomPage: (req, res) => {
    return Message.findAll({
      raw: true,
      nest: true,
      include: [{ model: User }]
    }).then((msg) => {
      // console.log(msg) 
      return res.render('chatroomPage', { msg: msg })
    })
  }
}

module.exports = userController
