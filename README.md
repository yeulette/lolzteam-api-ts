# lolzteam

[![npm version](https://badge.fury.io/js/lolzteam.svg)](https://www.npmjs.com/package/lolzteam)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![CI](https://github.com/your-org/lolzteam-ts/actions/workflows/publish.yml/badge.svg)](https://github.com/your-org/lolzteam-ts/actions)

TypeScript/JavaScript SDK для [LOLZ Forum](https://lolz.live) и [ZT.Market](https://lzt.market).

- ✅ Работает в **Node.js** и **Browser** (universal fetch)
- ✅ Полные **TypeScript** типы и автодополнение
- ✅ Автоматический **retry** на 429 / 502 / 503 с exponential back-off
- ✅ **Прокси** (Node.js: HTTP, HTTPS, SOCKS5)
- ✅ Все методы **авто-генерируются** из официальных OpenAPI схем
- ✅ ESM + CJS dual build
- ✅ MIT лицензия

---

## Содержание

- [Установка](#установка)
- [Быстрый старт](#быстрый-старт)
- [Опции клиента](#опции-клиента)
- [Изменение настроек в рантайме](#изменение-настроек-в-рантайме)
- [Прокси](#прокси)
- [Авто-retry](#авто-retry)
- [Forum API](#forum-api)
  - [OAuth](#oauth)
  - [Категории](#категории)
  - [Форумы](#форумы)
  - [Темы (Threads)](#темы-threads)
  - [Посты (Posts)](#посты-posts)
  - [Пользователи (Users)](#пользователи-users)
  - [Посты профиля (Profile Posts)](#посты-профиля-profile-posts)
  - [Личные сообщения (Conversations)](#личные-сообщения-conversations)
  - [Уведомления](#уведомления)
  - [Теги](#теги)
  - [Поиск](#поиск)
  - [Чатбокс](#чатбокс)
  - [Формы](#формы)
- [Market API](#market-api)
  - [Профиль и баланс](#профиль-и-баланс)
  - [Категории аккаунтов](#категории-аккаунтов)
  - [Управление лотами](#управление-лотами)
  - [Платежи](#платежи)
  - [Ставки и покупка](#ставки-и-покупка)
  - [Теги и фильтры маркета](#теги-и-фильтры-маркета)
- [Сырые запросы](#сырые-запросы)
- [Использование в браузере](#использование-в-браузере)
- [Генерация кода из OpenAPI схем](#генерация-кода-из-openapi-схем)
- [Сборка и тесты](#сборка-и-тесты)
- [CI/CD](#cicd--автопубликация-в-npm)
- [Структура проекта](#структура-проекта)
- [Лицензия](#лицензия)

---

## Установка

```bash
npm install lolzteam
# или
yarn add lolzteam
```

Для поддержки прокси (опционально):

```bash
npm install socks-proxy-agent https-proxy-agent
```

---

## Быстрый старт

```typescript
import { Forum, Market } from "lolzteam";

const forum  = new Forum({ token: "YOUR_TOKEN" });
const market = new Market({ token: "YOUR_TOKEN" });

// Получить пользователя
const user = await (await forum.Users_Get({ userId: 2410024 })).json();
console.log(user);

// Получить профиль маркета
const me = await (await market.getMe()).json();
console.log(me);
```

Все методы возвращают `Promise<Response>` — стандартный fetch Response. Данные получаются через `.json()`.

---

## Опции клиента

| Опция | Тип | По умолчанию | Описание |
|-------|-----|-------------|----------|
| `token` | `string` | **обязательно** | Bearer токен |
| `language` | `string` | `"en"` | Язык ответов: `"ru"` или `"en"` |
| `proxy` | `string` | — | URL прокси (только Node.js) |
| `timeoutMs` | `number` | `30000` | Таймаут запроса в мс |
| `delayMs` | `number` | `500` | Минимальная задержка между запросами в мс |

```typescript
const forum = new Forum({
  token: "YOUR_TOKEN",
  language: "ru",
  proxy: "socks5://user:pass@host:1080",
  timeoutMs: 15000,
  delayMs: 300,
});
```

---

## Изменение настроек в рантайме

```typescript
const forum = new Forum({ token: "YOUR_TOKEN" });

forum.token    = "NEW_TOKEN";
forum.language = "ru";
forum.proxy    = "socks5://user:pass@host:1080";
forum.proxy    = undefined; // убрать прокси
```

---

## Прокси

```typescript
// HTTP/HTTPS прокси
const forum = new Forum({ token: "YOUR_TOKEN", proxy: "http://host:8080" });

// SOCKS5 прокси
const market = new Market({ token: "YOUR_TOKEN", proxy: "socks5://user:pass@host:1080" });

// Смена прокси на лету
forum.proxy = "socks5://newhost:1080";
forum.proxy = undefined; // отключить
```

> Требуется: `npm install socks-proxy-agent https-proxy-agent`

---

## Авто-retry

SDK автоматически повторяет запросы при статусах **429**, **502**, **503** — до 5 попыток с exponential back-off + jitter. Заголовок `Retry-After` учитывается автоматически. Настраивать ничего не нужно.

---

## Forum API

Базовый URL: `https://prod-api.lolz.live`

### OAuth

```typescript
// Получить токен (POST /oauth/token)
await forum.OAuth_Token();
```

### Категории

```typescript
// Список категорий (GET /categories)
await forum.Categories_List();
await forum.Categories_List({ parentCategoryId: 1, order: "natural" });

// Получить категорию (GET /categories/:categoryId)
await forum.Categories_Get({ categoryId: 5 });
```

### Форумы

```typescript
// Список форумов (GET /forums)
await forum.Forums_List();
await forum.Forums_List({ parentCategoryId: 1 });

// Дерево форумов (GET /forums/grouped)
await forum.Forums_Grouped();

// Получить форум (GET /forums/:forumId)
await forum.Forums_Get({ forumId: 876 });

// Подписчики форума (GET /forums/:forumId/followers)
await forum.Forums_Followers({ forumId: 876 });

// Подписаться на форум (POST /forums/:forumId/followers)
await forum.Forums_Follow({ forumId: 876, post: true, alert: true, email: false });

// Отписаться от форума (DELETE /forums/:forumId/followers)
await forum.Forums_Unfollow({ forumId: 876 });

// Мои подписки на форумы (GET /forums/followed)
await forum.Forums_Followed();
await forum.Forums_Followed({ total: true });

// Настройки ленты (GET /forums/feed/options)
await forum.Forums_GetFeedOptions();

// Изменить ленту (PUT /forums/feed/options)
await forum.Forums_EditFeedOptions({ nodeIds: [876, 123], keywords: ["продажа"] });
```

### Страницы и навигация

```typescript
// Список страниц (GET /pages)
await forum.Pages_List();
await forum.Pages_List({ parentPageId: 1 });

// Получить страницу (GET /pages/:pageId)
await forum.Pages_Get({ pageId: 10 });

// Навигация (GET /navigation)
await forum.Navigation_List();
await forum.Navigation_List({ parent: 0 });

// Ссылки-форумы (GET /link-forums)
await forum.Links_List();
await forum.Links_Get({ linkId: 5 });
```

### Темы (Threads)

```typescript
// Список тем (GET /threads)
await forum.Threads_List();
await forum.Threads_List({
  forumId: 876,
  page: 1,
  limit: 20,
  order: "thread_update_date",
  direction: "desc",
  sticky: false,
});

// Создать тему (POST /threads)
await forum.Threads_Create({
  forumId: 876,
  postBody: "Текст первого поста",
  title: "Заголовок темы",
  tags: ["тег1", "тег2"],
});

// Создать конкурс (POST /contests)
await forum.Threads_CreateContest({
  postBody: "Описание конкурса",
  contestType: "user_money",
  prizeType: "money",
  requireLikeCount: 10,
  requireTotalLikeCount: 100,
  title: "Конкурс",
  countWinners: 3,
  prizeDataMoney: 500,
});

// Создать жалобу (POST /claims)
await forum.Threads_Claim({
  asResponder: "username",
  asIsMarketDeal: true,
  asAmount: 1000,
  transferType: "transfer",
  postBody: "Описание проблемы",
  currency: "rub",
});

// Получить тему (GET /threads/:threadId)
await forum.Threads_Get({ threadId: 1234567 });

// Редактировать тему (PUT /threads/:threadId)
await forum.Threads_Edit({ threadId: 1234567, title: "Новый заголовок" });

// Удалить тему (DELETE /threads/:threadId)
await forum.Threads_Delete({ threadId: 1234567, reason: "причина" });

// Переместить тему (POST /threads/:threadId/move)
await forum.Threads_Move({ threadId: 1234567, nodeId: "123" });

// Поднять тему (POST /threads/:threadId/bump)
await forum.Threads_Bump({ threadId: 1234567 });

// Скрыть тему (POST /threads/:threadId/hide)
await forum.Threads_Hide({ threadId: 1234567 });

// Добавить в закладки (POST /threads/:threadId/star)
await forum.Threads_Star({ threadId: 1234567 });

// Убрать из закладок (DELETE /threads/:threadId/star)
await forum.Threads_Unstar({ threadId: 1234567 });

// Подписчики темы (GET /threads/:threadId/followers)
await forum.Threads_Followers({ threadId: 1234567 });

// Подписаться на тему (POST /threads/:threadId/followers)
await forum.Threads_Follow({ threadId: 1234567, email: false });

// Отписаться от темы (DELETE /threads/:threadId/followers)
await forum.Threads_Unfollow({ threadId: 1234567 });

// Мои подписки на темы (GET /threads/followed)
await forum.Threads_Followed();

// Навигация темы (GET /threads/:threadId/navigation)
await forum.Threads_Navigation({ threadId: 1234567 });

// Голосование в теме (GET /threads/:threadId/poll)
await forum.Threads_Poll_Get({ threadId: 1234567 });

// Проголосовать (POST /threads/:threadId/poll/votes)
await forum.Threads_Poll_Vote({ threadId: 1234567, responseId: 2 });

// Непрочитанные темы (GET /threads/new)
await forum.Threads_Unread({ limit: 20, forumId: 876 });

// Недавние темы (GET /threads/recent)
await forum.Threads_Recent({ days: 7, limit: 20 });

// Завершить конкурс (POST /contests/:threadId/finish)
await forum.Threads_Finish({ threadId: 1234567 });
```

### Посты (Posts)

```typescript
// Список постов темы (GET /posts)
await forum.Posts_List({ threadId: 1234567 });
await forum.Posts_List({ threadId: 1234567, page: 2, limit: 20, order: "natural" });

// Создать пост (POST /posts)
await forum.Posts_Create({ threadId: 1234567, postBody: "Текст поста" });
await forum.Posts_Create({ threadId: 1234567, postBody: "Ответ", quotePostId: 9876543 });

// Получить пост (GET /posts/:postId)
await forum.Posts_Get({ postId: 9876543 });

// Редактировать пост (PUT /posts/:postId)
await forum.Posts_Edit({ postId: 9876543, postBody: "Новый текст" });

// Удалить пост (DELETE /posts/:postId)
await forum.Posts_Delete({ postId: 9876543, reason: "причина" });

// Лайки поста (GET /posts/:postId/likes)
await forum.Posts_Likes({ postId: 9876543 });

// Лайкнуть пост (POST /posts/:postId/likes)
await forum.Posts_Like({ postId: 9876543 });

// Убрать лайк (DELETE /posts/:postId/likes)
await forum.Posts_Unlike({ postId: 9876543 });

// Пожаловаться на пост (POST /posts/:postId/report)
await forum.Posts_Report({ postId: 9876543, message: "Причина жалобы" });

// Комментарии к посту (GET /posts/comments)
await forum.Posts_Comments_Get({ postId: 9876543 });

// Создать комментарий (POST /posts/comments)
await forum.Posts_Comments_Create({ postId: 9876543, commentBody: "Комментарий" });

// Редактировать комментарий (PUT /posts/comments)
await forum.Posts_Comments_Edit({ postCommentId: 111, commentBody: "Новый текст" });

// Удалить комментарий (DELETE /posts/comments)
await forum.Posts_Comments_Delete({ postCommentId: 111 });

// Пожаловаться на комментарий (POST /posts/comments/report)
await forum.Posts_Comments_Report({ postCommentId: 111, message: "Причина" });
```

### Пользователи (Users)

```typescript
// Список пользователей (GET /users)
await forum.Users_List({ page: 1, limit: 20 });

// Поля пользователя (GET /users/fields)
await forum.Users_Fields();

// Найти пользователей (GET /users/find)
await forum.Users_Find({ username: "nickname" });

// Получить пользователя (GET /users/:userId)
await forum.Users_Get({ userId: 2410024 });
// Удобный алиас (snake_case)
await forum.usersGet({ user_id: 2410024 });

// Редактировать пользователя (PUT /users/:userId)
await forum.Users_Edit({ userId: 2410024, userTitle: "Новый статус" });

// Жалобы пользователя (GET /users/:userId/claims)
await forum.Users_Claims({ userId: 2410024 });

// Аватар: загрузить / удалить / обрезать
await forum.Users_Avatar_Upload({ userId: 2410024, avatar: "base64..." });
await forum.Users_Avatar_Delete({ userId: 2410024 });
await forum.Users_Avatar_Crop({ userId: 2410024, x: 0, y: 0, crop: 100 });

// Фон профиля: загрузить / удалить / обрезать
await forum.Users_Background_Upload({ userId: 2410024, background: "base64..." });
await forum.Users_Background_Delete({ userId: 2410024 });
await forum.Users_Background_Crop({ userId: 2410024, x: 0, y: 0, crop: 200 });

// Подписчики пользователя (GET /users/:userId/followers)
await forum.Users_Followers({ userId: 2410024, limit: 20 });

// Подписаться / отписаться
await forum.Users_Follow({ userId: 2410024 });
await forum.Users_Unfollow({ userId: 2410024 });

// Подписки пользователя (GET /users/:userId/followings)
await forum.Users_Followings({ userId: 2410024 });

// Лайки пользователя (GET /users/:userId/likes)
await forum.Users_Likes({ userId: 2410024 });

// Игнор-лист (GET /users/ignored)
await forum.Users_Ignored();

// Игнорировать / разигнорировать
await forum.Users_Ignore({ userId: 2410024 });
await forum.Users_IgnoreEdit({ userId: 2410024, ignoreConversations: true });
await forum.Users_Unignore({ userId: 2410024 });

// Контент пользователя (GET /users/:userId/timeline)
await forum.Users_Contents({ userId: 2410024, page: 1 });

// Трофеи пользователя (GET /users/:userId/trophies)
await forum.Users_Trophies({ userId: 2410024 });

// Секретный ответ
await forum.Users_SecretAnswerTypes();
await forum.Users_SA_Reset();
await forum.Users_SA_CancelReset();
```

### Посты профиля (Profile Posts)

```typescript
// Список постов на стене (GET /users/:userId/profile-posts)
await forum.ProfilePosts_List({ userId: 2410024 });

// Получить пост (GET /profile-posts/:profilePostId)
await forum.ProfilePosts_Get({ profilePostId: 555 });

// Создать пост на стене (POST /profile-posts)
await forum.ProfilePosts_Create({ userId: 2410024, postBody: "Привет!" });

// Редактировать (PUT /profile-posts/:profilePostId)
await forum.ProfilePosts_Edit({ profilePostId: 555, postBody: "Новый текст" });

// Удалить (DELETE /profile-posts/:profilePostId)
await forum.ProfilePosts_Delete({ profilePostId: 555 });

// Закрепить / открепить
await forum.ProfilePosts_Stick({ profilePostId: 555 });
await forum.ProfilePosts_Unstick({ profilePostId: 555 });

// Лайки (GET / POST / DELETE)
await forum.ProfilePosts_Likes({ profilePostId: 555 });
await forum.ProfilePosts_Like({ profilePostId: 555 });
await forum.ProfilePosts_Unlike({ profilePostId: 555 });

// Пожаловаться (POST /profile-posts/:profilePostId/report)
await forum.ProfilePosts_Report({ profilePostId: 555, message: "Причина" });

// Комментарии
await forum.ProfilePosts_Comments_List({ profilePostId: 555 });
await forum.ProfilePosts_Comments_Create({ profilePostId: 555, commentBody: "Комментарий" });
await forum.ProfilePosts_Comments_Edit({ commentId: 666, commentBody: "Новый текст" });
await forum.ProfilePosts_Comments_Delete({ commentId: 666 });
await forum.ProfilePosts_Comments_Get({ profilePostId: 555, commentId: 666 });
await forum.ProfilePosts_Comments_Report({ commentId: 666, message: "Причина" });
```

### Личные сообщения (Conversations)

```typescript
// Список диалогов (GET /conversations)
await forum.Conversations_List();
await forum.Conversations_List({ folder: "inbox", page: 1, limit: 20 });

// Создать диалог (POST /conversations)
await forum.Conversations_Create({
  recipientId: 2410024,
  messageBody: "Привет!",
});

// Групповой диалог
await forum.Conversations_Create({
  recipients: ["user1", "user2"],
  isGroup: true,
  title: "Название группы",
  messageBody: "Привет всем!",
});

// Начать диалог (POST /conversations/start)
await forum.Conversations_Start({ userId: 2410024 });

// Редактировать диалог (PUT /conversations)
await forum.Conversations_Update({ conversationId: 777, title: "Новое название" });

// Покинуть диалог (DELETE /conversations)
await forum.Conversations_Delete({ conversationId: 777, deleteType: "delete" });

// Получить диалог (GET /conversations/:conversationId)
await forum.Conversations_Get({ conversationId: 777 });

// Сохранить в избранное (POST /conversations/save)
await forum.Conversations_Save({ link: "https://lolz.live/..." });

// Сообщения в диалоге (GET /conversations/:conversationId/messages)
await forum.Conversations_Messages_List({ conversationId: 777 });
await forum.Conversations_Messages_List({ conversationId: 777, page: 2, limit: 50 });

// Отправить сообщение (POST /conversations/:conversationId/messages)
await forum.Conversations_Messages_Create({ conversationId: 777, messageBody: "Ответ" });
await forum.Conversations_Messages_Create({
  conversationId: 777,
  messageBody: "Цитата",
  replyMessageId: 888,
});

// Получить сообщение (GET /conversations/messages/:messageId)
await forum.Conversations_Messages_Get({ messageId: 888 });

// Редактировать сообщение (PUT /conversations/:conversationId/messages/:messageId)
await forum.Conversations_Messages_Edit({ conversationId: 777, messageId: 888, messageBody: "Исправлено" });

// Удалить сообщение (DELETE /conversations/:conversationId/messages/:messageId)
await forum.Conversations_Messages_Delete({ conversationId: 777, messageId: 888 });

// Поиск по диалогам (POST /conversations/search)
await forum.Conversations_Search({ q: "текст", conversationId: 777 });

// Пригласить участника (POST /conversations/:conversationId/invite)
await forum.Conversations_Invite({ conversationId: 777, recipients: ["username"] });

// Исключить участника (POST /conversations/:conversationId/kick)
await forum.Conversations_Kick({ conversationId: 777, userId: 2410024 });

// Прочитать диалог (POST /conversations/:conversationId/read)
await forum.Conversations_Read({ conversationId: 777 });

// Прочитать все диалоги (POST /conversations/read-all)
await forum.Conversations_ReadAll();

// Закрепить / открепить сообщение
await forum.Conversations_Messages_Stick({ conversationId: 777, messageId: 888 });
await forum.Conversations_Messages_Unstick({ conversationId: 777, messageId: 888 });

// Звёздочка на диалоге
await forum.Conversations_Star({ conversationId: 777 });
await forum.Conversations_Unstar({ conversationId: 777 });

// Уведомления диалога
await forum.Conversations_Alerts_Enable({ conversationId: 777 });
await forum.Conversations_Alerts_Disable({ conversationId: 777 });
```

### Уведомления

```typescript
// Список уведомлений (GET /notifications)
await forum.Notifications_List();
await forum.Notifications_List({ page: 1, limit: 20 });

// Получить уведомление (GET /notifications/:notificationId/content)
await forum.Notifications_Get({ notificationId: 999 });

// Прочитать уведомление(я) (POST /notifications/read)
await forum.Notifications_Read();
await forum.Notifications_Read({ notificationId: 999 });
```

### Теги

```typescript
// Популярные теги (GET /tags)
await forum.Tags_Popular();

// Список тегов (GET /tags/list)
await forum.Tags_List({ page: 1, limit: 50 });

// Контент по тегу (GET /tags/:tagId)
await forum.Tags_Get({ tagId: 42 });

// Поиск тегов (GET /tags/find)
await forum.Tags_Find({ tag: "продажа" });
```

### Поиск

```typescript
// Общий поиск (POST /search)
await forum.Search_All({ q: "запрос", forumId: 876 });

// Поиск тем (POST /search/threads)
await forum.Search_Threads({ q: "запрос", forumId: 876, limit: 20 });

// Поиск постов (POST /search/posts)
await forum.Search_Posts({ q: "запрос", limit: 20 });

// Поиск пользователей (POST /search/users)
await forum.Search_Users({ q: "nickname" });

// Поиск постов профиля (POST /search/profile-posts)
await forum.Search_ProfilePosts({ q: "запрос" });

// Поиск по тегу (POST /search/tagged)
await forum.Search_Tagged({ tag: "продажа" });
await forum.Search_Tagged({ tags: ["тег1", "тег2"] });

// Результаты поиска по ID (GET /search/:searchId/results)
await forum.Search_Results({ searchId: "abc123" });

// Batch-запрос (POST /batch)
await forum.Batch_Execute();
```

### Чатбокс

```typescript
// Список чатов / комнат (GET /chatbox)
await forum.Chatbox_Index();
await forum.Chatbox_Index({ roomId: 1 });

// Сообщения чата (GET /chatbox/messages)
await forum.Chatbox_GetMessages({ roomId: 1 });
await forum.Chatbox_GetMessages({ roomId: 1, beforeMessageId: 555 });

// Отправить сообщение (POST /chatbox/messages)
await forum.Chatbox_PostMessage({ roomId: 1, message: "Привет!" });
await forum.Chatbox_PostMessage({ roomId: 1, message: "Ответ", replyMessageId: 555 });

// Редактировать сообщение (PUT /chatbox/messages)
await forum.Chatbox_EditMessage({ messageId: 555, message: "Исправлено" });

// Удалить сообщение (DELETE /chatbox/messages)
await forum.Chatbox_DeleteMessage({ messageId: 555 });

// Онлайн в чате (GET /chatbox/messages/online)
await forum.Chatbox_Online({ roomId: 1 });

// Пожаловаться на сообщение (POST /chatbox/messages/report)
await forum.Chatbox_Report({ messageId: 555, reason: "Причина" });

// Лидерборд чата (GET /chatbox/messages/leaderboard)
await forum.Chatbox_GetLeaderboard();
await forum.Chatbox_GetLeaderboard({ duration: "week" });

// Игнор в чате
await forum.Chatbox_GetIgnore();
await forum.Chatbox_PostIgnore({ userId: 2410024 });
await forum.Chatbox_DeleteIgnore({ userId: 2410024 });
```

### Формы

```typescript
// Список форм (GET /forms)
await forum.Forms_List();
await forum.Forms_List({ page: 1 });

// Создать форму (POST /forms/save)
await forum.Forms_Create();
```

---

## Market API

Базовый URL: `https://api.lzt.market`

### Профиль и баланс

```typescript
const market = new Market({ token: "YOUR_TOKEN" });

// Профиль (алиас для Profile_Get / GET /me)
const me = await (await market.getMe()).json();

// Перевод средств (POST /balance/transfer)
await market.transfer({
  receiver: "username",
  currency: "rub",
  amount: 100,
  comment: "Спасибо",
});
```

### Категории аккаунтов

Каждый метод принимает общие фильтры (`page`, `pmin`, `pmax`, `title`, `orderBy`, `currency`, ...) и специфичные для категории.

```typescript
// Все аккаунты (GET /)
await market.Category_All();
await market.Category_All({ pmin: 100, pmax: 1000, orderBy: "price_to_up" });

// Steam (GET /steam)
await market.Category_Steam({ game__: [730], rmin: 5, rmax: 20 });

// Fortnite (GET /fortnite)
await market.Category_Fortnite({ smin: 100, vbmin: 1000 });

// miHoYo / Genshin / HSR / ZZZ (GET /mihoyo)
await market.Category_Mihoyo({ genshinLevelMin: 50, region: ["eu"] });

// Riot / Valorant / LoL (GET /riot)
await market.Category_Riot({ valorantRankType__: ["diamond"] });

// Telegram (GET /telegram)
await market.Category_Telegram({ premium: "yes", minId: 100000 });

// Supercell / Brawl Stars / CoC (GET /supercell)
await market.Category_Supercell({ brawlLevelMin: 100 });

// EA / Origin (GET /ea)
await market.Category_EA({ game__: ["apex"] });

// World of Tanks (GET /world-of-tanks)
await market.Category_Wot({ battlesMin: 5000, goldMin: 1000 });

// WoT Blitz (GET /wot-blitz)
await market.Category_WotBlitz({ battlesMin: 3000 });

// ... и другие категории: Category_Gifts, и другие, доступны аналогично
```

### Управление лотами

```typescript
// Получить аккаунт (алиас для Managing_Get)
const item = await (await market.getItem({ item_id: 12345678 })).json();

// Прямой вызов (GET /:itemId)
await market.Managing_Get({ itemId: 12345678 });
await market.Managing_Get({ itemId: 12345678, parseSameItemIds: true });
```

### Платежи

```typescript
// История платежей (алиас для Payments_History)
const payments = await (await market.getPayments({ page: 1, limit: 20 })).json();

// Прямой вызов
await market.Payments_History();
await market.Payments_History({ page: 2, limit: 50 });
```

### Ставки и покупка

Методы покупки, ставок, отзывов и т.д. доступны напрямую через авто-генерируемые методы из OpenAPI схемы.

```typescript
// Примеры прямых вызовов
await market.Profile_Get();

// Перевод средств через transfer-алиас
await market.transfer({ receiver: "username", currency: "rub", amount: 500 });
```

### Теги и фильтры маркета

Все категории поддерживают общие параметры:

| Параметр | Тип | Описание |
|----------|-----|----------|
| `page` | `number` | Страница |
| `pmin` | `number` | Минимальная цена |
| `pmax` | `number` | Максимальная цена |
| `title` | `string` | Поиск по заголовку |
| `orderBy` | `string` | Сортировка (price_to_up, price_to_down, newest, ...) |
| `currency` | `string` | Валюта (rub, usd, eur, ...) |
| `userId` | `number` | ID продавца |
| `nsb` | `boolean` | Не продаётся |
| `sb` | `boolean` | Продаётся |
| `emailLoginData` | `boolean` | Есть данные почты |
| `parseSameItemIds` | `boolean` | Похожие лоты |

---

## Сырые запросы

Если нужен метод, которого нет в алиасах — используйте `request()`:

```typescript
// GET с query-параметрами
const resp = await forum.request("GET", "/users/me");
const data = await resp.json();

// POST с JSON-телом
const resp2 = await forum.request("POST", "/posts", {
  json: { thread_id: 1, post_body: "Привет" },
});

// GET с query-параметрами
const resp3 = await market.request("GET", "/", {
  params: { category_id: 24, orderBy: "price_to_up", pmax: 500 },
});

// DELETE с телом
const resp4 = await forum.request("DELETE", "/posts/12345", {
  json: { reason: "Причина" },
});
```

---

## Использование в браузере (ESM)

```html
<script type="module">
  import { Forum, Market } from "https://cdn.jsdelivr.net/npm/lolzteam/dist/esm/index.js";

  const forum = new Forum({ token: "YOUR_TOKEN" });

  const resp = await forum.Users_Get({ userId: 2410024 });
  const data = await resp.json();
  console.log(data);
</script>
```

---

## Генерация кода из OpenAPI схем

Все API методы генерируются автоматически из официальных OpenAPI схем командой `npm run codegen`.

### Обновить схемы и перегенерировать

```bash
# Скачать актуальные схемы
curl -o codegen/schemas/forum.json \
  "https://raw.githubusercontent.com/AS7RIDENIED/LOLZTEAM/main/Official%20Documentation/forum.json"

curl -o codegen/schemas/market.json \
  "https://raw.githubusercontent.com/AS7RIDENIED/LOLZTEAM/main/Official%20Documentation/market.json"

# Запустить генератор (оба)
npm run codegen

# Только форум
npm run codegen:forum

# Только маркет
npm run codegen:market
```

### Генератор напрямую

```bash
npx ts-node codegen/generate.ts \
  --schema codegen/schemas/forum.json \
  --output src/forum/_generated.ts \
  --class ForumAPI
```

Генератор принимает аргументы:

| Аргумент | Описание |
|----------|----------|
| `--schema` | Путь к OpenAPI JSON-схеме |
| `--output` | Путь к выходному TypeScript-файлу |
| `--class` | Имя генерируемого класса |

---

## Сборка и тесты

```bash
# Установить зависимости
npm install

# Запустить тесты
npm test

# Сборка (CJS + ESM + types)
npm run build

# Ручное тестирование с реальным токеном
TOKEN=your_token npx ts-node test.ts
```

---

## CI/CD — автопубликация в npm

При пуше тега `v*.*.*` GitHub Actions запускает:

1. **Тесты** на Node 18 / 20 / 22
2. **Скачивание** актуальных OpenAPI схем
3. **Регенерацию** методов
4. **Сборку** и **публикацию** в npm с provenance

Для работы нужен секрет `NPM_TOKEN` в Settings → Secrets репозитория.

```bash
# Создать и запушить тег
git tag v1.0.1
git push origin v1.0.1
```

---

## Структура проекта

```
lolzteam-ts/
├── codegen/
│   ├── generate.ts          ← OpenAPI → TypeScript генератор
│   └── schemas/
│       ├── forum.json       ← OpenAPI схема форума
│       └── market.json      ← OpenAPI схема маркета
├── src/
│   ├── index.ts             ← Точка входа: export { Forum, Market }
│   ├── core/
│   │   ├── client.ts        ← HTTP клиент (fetch, retry, proxy, throttle)
│   │   ├── base.ts          ← BaseClient (setters token / language / proxy)
│   │   ├── mixin.ts         ← ApiMixin — базовый класс для генерируемых классов
│   │   └── index.ts         ← Реэкспорт core
│   ├── forum/
│   │   ├── index.ts         ← Класс Forum (алиасы + mixin-инъекция)
│   │   └── _generated.ts    ← АВТО-ГЕНЕРИРУЕТСЯ: все методы Forum API
│   └── market/
│       ├── index.ts         ← Класс Market (алиасы + mixin-инъекция)
│       └── _generated.ts    ← АВТО-ГЕНЕРИРУЕТСЯ: все методы Market API
├── tests/
│   └── sdk.test.ts          ← Юнит-тесты (Jest)
├── .github/
│   └── workflows/
│       └── publish.yml      ← CI/CD → автопубликация в npm
├── package.json
├── tsconfig.json
├── tsconfig.cjs.json        ← CommonJS сборка
├── tsconfig.esm.json        ← ESM сборка
├── tsconfig.types.json      ← Сборка деклараций (.d.ts)
└── LICENSE                  ← MIT
```

---

## Лицензия

[MIT](LICENSE) © lolzteam-sdk contributors
