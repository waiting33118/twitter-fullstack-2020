const express = require('express')
const router = express.Router()
const passport = require('../config/passport')
const helper = require('../_helpers')

const tweetController = require('../controllers/tweetController')
const adminController = require('../controllers/adminController')
const userController = require('../controllers/userController')

const multer = require('multer')
const upload = multer({ dest: 'temp/' })

// 判斷是否已登入
const authenticated = (req, res, next) => {
  if (helper.ensureAuthenticated(req)) {
    if (!helper.getUser(req).role) helper.getUser(req).role = 'user'
    if (helper.getUser(req).role === 'user') return next()
    req.flash('error_messages', '管理者無法使用前台服務，只能登入後台！')
    return res.redirect('/admin/tweets')
  }
  req.flash('error_messages', '請先進行登入！')
  return res.redirect('/signin')
}
// 判斷是否已登入且為管理者
const adminAuthenticated = (req, res, next) => {
  if (helper.ensureAuthenticated(req)) {
    if (helper.getUser(req).role === 'admin') return next()
    req.flash('error_messages', '禁止訪問！請向管理員申請管理者權限！')
    return res.redirect('/signin')
  }
  req.flash('error_messages', '請先進行登入！')
  return res.redirect('/admin/signin')
}

// Root path
// 首頁
router.get('/', (req, res) => res.redirect('/tweets'))
router.get('/tweets', authenticated, userController.getRecommendedUsers, tweetController.getHomePage)
router.get('/tweets/:tweetId/replies', authenticated, userController.getRecommendedUsers, tweetController.getReplyPage)
// 發推
router.post('/tweets', authenticated, tweetController.postTweet)
router.delete('/tweets/:tweetId', authenticated, tweetController.deleteTweet)
// 回應推文
router.post('/tweets/:tweetId/replies', authenticated, tweetController.postReply)
router.delete('/tweets/:tweetId/:replyId', authenticated, tweetController.deleteReply)
// 回應留言
router.post('/tweets/:tweetId/:replyId/:replyTo', authenticated, tweetController.postSecondReply)
// Followship
router.post('/followships', authenticated, userController.addFollowing)
router.delete('/followships/:userId', authenticated, userController.removeFollowing)
// Like
router.post('/tweets/:tweetId/like', authenticated, tweetController.addLike)
router.post('/tweets/:tweetId/unlike', authenticated, tweetController.removeLike)
router.post('/replies/:replyId/like', authenticated, tweetController.addLike)
router.post('/replies/:replyId/unlike', authenticated, tweetController.removeLike)
router.post('/secondreplies/:secondReplyId/like', authenticated, tweetController.addLike)
router.post('/secondreplies/:secondReplyId/unlike', authenticated, tweetController.removeLike)
// 取得登入頁面
router.get('/signin', userController.userSigninPage)
// 取得註冊頁面
router.get('/signup', userController.userSignupPage)
// 登出
router.get('/signout', userController.signout)
// 取得帳號設定頁面
router.get('/setting', authenticated, userController.accountSettingPage)
// 公開聊天室
router.get('/chatroom', authenticated, userController.chatroomPage)
// 回傳登入資訊
router.post('/signin', userController.userCheckRequired, passport.authenticate('local', { failureRedirect: '/signin' }), userController.userSigninSuccess)
// 回傳註冊資訊
router.post('/signup', userController.userSignup)
// 回傳帳號設定資訊
router.post('/setting', authenticated, userController.accountSetting)

// ADMIN
// 轉址至管理者登入頁面
router.get('/admin', (req, res) => res.redirect('/admin/signin'))
// 取得管理者登入頁面
router.get('/admin/signin', adminController.adminSigninPage)
// 取得管理推文頁面
router.get('/admin/tweets', adminAuthenticated, adminController.adminTweetsPage)
// 取得管理使用者頁面
router.get('/admin/users', adminAuthenticated, adminController.adminUsersPage)
// 回傳管理者登入資訊
router.post('/admin/signin', adminController.adminCheckRequired, passport.authenticate('local', { failureRedirect: '/admin/signin' }), adminController.adminSigninSuccess)
// 管理者刪除推文
router.delete('/admin/tweets/:tweetId', adminAuthenticated, adminController.adminDeleteTweets)

// USER
// 取得個人推文頁面
router.get('/users/:id/tweets', authenticated, userController.getRecommendedUsers, userController.getUser)
// 取得個人like內容頁面
router.get('/users/:id/likes', authenticated, userController.getRecommendedUsers, userController.getUserLikeContent)
// 取得個人回覆過的推文頁面
router.get('/users/:id/repliesTweet', authenticated, userController.getRecommendedUsers, userController.getUserRepliesTweets)
// 編輯個人資料頁面
router.get('/users/:id/edit', authenticated, userController.editUser)
// 編輯個人資料
router.put('/users/:id/edit', authenticated, upload.fields([
  { name: 'cover', maxCount: 1 },
  { name: 'avatar', maxCount: 1 }
]), userController.putUser)
// 查看跟隨者名單
router.get('/users/:id/followers', authenticated, userController.getRecommendedUsers, userController.getUserFollowerList)
// 查看追隨者名單
router.get('/users/:id/followings', authenticated, userController.getRecommendedUsers, userController.getUserFollowingList)

module.exports = router
