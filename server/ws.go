package server

import (
	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
	"time"
)

type WSType int

const (
	NONE                WSType = iota // 0
	ERROR                             // 1
	CONFIG_DISCOVERABLE               // 2
	// NOTE: sended by the client when they ready to share
	START_SHARING // 3
	// NOTE: sended by the server the list of discoverable user
	USER_SHARE_LIST // 4
	// NOTE: sended by the client to give the pubkey of who is the user they want to sent into
	USER_SHARE_TARGET // 5
)

type WSMessage struct {
	WSType WSType `json:"type"`
	Data   any    `json:"data"`
}

func sendWS(c *websocket.Conn, t WSType, data any) {
	_ = c.WriteJSON(WSMessage{
		WSType: t,
		Data:   data,
	})
}

func HandleWS(s *Server, mUser *ManagedUser) {
	done := make(chan struct{})
	defer close(done)

	startJWTExpiryWatcher(mUser.Conn, mUser.JWTExpiry, done)
	for {
		// TODO: when the JWT expired then error out or disconnect this connection
		var msg WSMessage
		if err := mUser.Conn.ReadJSON(&msg); err != nil {
			break
		}

		switch msg.WSType {
		case CONFIG_DISCOVERABLE:
			n, ok := msg.Data.(bool)
			if !ok {
				sendWS(mUser.Conn, ERROR, "invalid websocket message")
				continue
			}
			var user User
			res := s.DB.Where("public_key = ?", mUser.User.PublicKey).First(&user).Error
			if res != nil {
				sendWS(mUser.Conn, ERROR, "invalid public key")
				continue
			}
			user.IsDiscoverable = n
			res = s.DB.Save(&user).Error
			if res != nil {
				sendWS(mUser.Conn, ERROR, "db failed to save your changes")
				continue
			}
			sendWS(mUser.Conn, CONFIG_DISCOVERABLE, "success")
			continue
		case START_SHARING:
			sendWS(mUser.Conn, USER_SHARE_LIST, s.CachedUser)
			continue
		case USER_SHARE_TARGET:
			targetKeys, ok := msg.Data.([]any)
			if !ok {
				sendWS(mUser.Conn, ERROR, "invalid data for USER_SHARE_TARGET")
				continue
			}

			var targets []*ManagedUser
			s.MUserMu.RLock()
			for _, key := range targetKeys {
				keyStr, ok := key.(string)
				if !ok {
					continue
				}
				for _, managedUser := range s.MUser {
					if managedUser.User.PublicKey == keyStr {
						targets = append(targets, managedUser)
						break
					}
				}
			}
			s.MUserMu.RUnlock()

			if len(targets) == 0 {
				sendWS(mUser.Conn, ERROR, "no valid target users found")
				continue
			}

			txID := uuid.New().String()
			transaction := &Transaction{
				ID:      txID,
				Sender:  mUser,
				Targets: targets,
			}

			s.TransactionMu.Lock()
			s.Transactions[txID] = transaction
			s.TransactionMu.Unlock()

			sendWS(mUser.Conn, USER_SHARE_TARGET, txID)
			continue
		}
	}
}

func startJWTExpiryWatcher(c *websocket.Conn, exp time.Time, done <-chan struct{}) {
	go func() {
		select { // this is switch case for channel
		case <-time.After(time.Until(exp)):
			_ = c.WriteMessage(
				websocket.CloseMessage,
				websocket.FormatCloseMessage(
					websocket.ClosePolicyViolation,
					"jwt expired",
				),
			)
			c.Close()
		case <-done:
			return
		}
	}()
}
