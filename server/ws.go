package server

import (
	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
	"github.com/mitchellh/mapstructure"
	"time"
)

type WSType int

const (
	NONE                WSType = iota	// 0
	ERROR								// 1

	CONFIG_DISCOVERABLE					// 2

	START_SHARING						// 3
	USER_SHARE_LIST						// 4

	NEW_TRANSACTION						// 5
	INFO_TRANSACTION                    // 6
	DELETE_TRANSACTION					// 7

	USER_SHARE_TARGET					// 8
	FILE_SHARE_TARGET					// 9

	START_TRANSACTION					// 10
	TRANSACTION_SHARE_ACCEPT            // 11
	WEBRTC_SIGNAL                       // 12
)

type WSMessage struct {
	WSType WSType `json:"type"`
	Data   any    `json:"data"`
}

type WebRTCSignal struct {
	TransactionID string `json:"transaction_id"`
	TargetKey     string `json:"target_key"`
	Data          any    `json:"data"`
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
		case NEW_TRANSACTION:
			txID := uuid.New().String()
			transaction := &Transaction{
				ID:      txID,
				Sender:  mUser,
				Targets: nil,
				Files:   nil,
				Started: false,
			}

			s.TransactionMu.Lock()
			s.Transactions[txID] = transaction
			s.TransactionMu.Unlock()
			sendWS(mUser.Conn, USER_SHARE_TARGET, transaction.ID)
			continue
		case INFO_TRANSACTION:
			n, ok := msg.Data.(string)
			if !ok {
				sendWS(mUser.Conn, ERROR, "invalid websocket message")
				continue
			}

			s.TransactionMu.RLock()
			sendWS(mUser.Conn, USER_SHARE_TARGET, s.Transactions[n])
			s.TransactionMu.RUnlock()
			continue
		case DELETE_TRANSACTION:
			var valid bool = true
			n, ok := msg.Data.(string)
			if !ok {
				sendWS(mUser.Conn, ERROR, "invalid websocket message")
				continue
			}

			var target []*ManagedUser

			s.TransactionMu.Lock()

			if mUser.MinUser.PublicKey == s.Transactions[n].Sender.MinUser.PublicKey {
				for _, user := range s.Transactions[n].Targets {
					target = append(target, user.User)
				}
				delete(s.Transactions, n)
			} else {
				valid = false
			}

			s.TransactionMu.Unlock()

			if valid {
				s.TransactionMu.RLock()

				for _, user := range target {
					sendWS(user.Conn, USER_SHARE_TARGET, n)
				}
				sendWS(mUser.Conn, USER_SHARE_TARGET, n)

				s.TransactionMu.RUnlock()
			}
			continue
		case USER_SHARE_TARGET:
			var data struct {
				TransactionID string   `json:"transaction_id"`
				PublicKey     []string `json:"public_keys"`
			}

			if err := mapstructure.Decode(msg.Data, &data); err != nil {
				sendWS(mUser.Conn, ERROR, "invalid data for USER_SHARE_TARGET")
				continue
			}

			if mUser != s.Transactions[data.TransactionID].Sender {
				sendWS(mUser.Conn, ERROR, "not authorized to modify this transaction")
				continue
			}

			var targets []*TransactionTarget
			s.MUserMu.RLock()
			for _, key := range data.PublicKey {
				for _, managedUser := range s.MUser {
					if managedUser.User.PublicKey == key {
						targets = append(targets, &TransactionTarget{managedUser, Pending})
						break
					}
				}
			}
			s.MUserMu.RUnlock()

			if len(targets) == 0 {
				sendWS(mUser.Conn, ERROR, "no valid target users found")
				continue
			}

			s.TransactionMu.Lock()
			s.Transactions[data.TransactionID].Targets = targets
			s.TransactionMu.Unlock()

			// Notify targets
			s.TransactionMu.RLock()
			for _, target := range targets {
				sendWS(target.User.Conn, TRANSACTION_SHARE_ACCEPT, struct {
					Transaction *Transaction `json:"transaction"`
					Sender      string       `json:"sender"`
				}{
					Transaction: s.Transactions[data.TransactionID],
					Sender:      mUser.MinUser.Username,
				})
			}

			sendWS(mUser.Conn, USER_SHARE_TARGET, s.Transactions[data.TransactionID])
			s.TransactionMu.RUnlock()
			continue
		case FILE_SHARE_TARGET:
			var data struct {
				TransactionID string     `json:"transaction_id"`
				Files         []FileInfo `json:"files"`
			}
			if err := mapstructure.Decode(msg.Data, &data); err != nil {
				sendWS(mUser.Conn, ERROR, "invalid data for FILE_SHARE_TARGET")
				continue
			}

			if data.TransactionID == "" || len(data.Files) == 0 {
				sendWS(mUser.Conn, ERROR, "missing transaction_id or files")
				continue
			}

			s.TransactionMu.RLock()
			transaction, ok := s.Transactions[data.TransactionID]
			s.TransactionMu.RUnlock()

			if !ok {
				sendWS(mUser.Conn, ERROR, "transaction not found")
				continue
			}

			if transaction.Sender != mUser {
				sendWS(mUser.Conn, ERROR, "not authorized to modify this transaction")
				continue
			}

			// Convert []FileInfo to []*FileInfo
			files := make([]*FileInfo, len(data.Files))
			for i := range data.Files {
				files[i] = &data.Files[i]
			}

			s.TransactionMu.Lock()
			transaction.Files = files
			s.TransactionMu.Unlock()

			sendWS(mUser.Conn, FILE_SHARE_TARGET, "files added to transaction")
			continue
		case TRANSACTION_SHARE_ACCEPT:
			var data struct {
				TransactionID string `json:"transaction_id"`
				Accept        bool   `json:"accept"`
			}
			if err := mapstructure.Decode(msg.Data, &data); err != nil {
				sendWS(mUser.Conn, ERROR, "invalid data for FILE_SHARE_ACCEPT")
				continue
			}

			s.TransactionMu.Lock()
			defer s.TransactionMu.Unlock()

			tx, ok := s.Transactions[data.TransactionID]
			if !ok {
				sendWS(mUser.Conn, ERROR, "transaction not found")
				continue
			}

			for _, target := range tx.Targets {
				if target.User == mUser {
					if data.Accept {
						target.Status = Accepted
					} else {
						target.Status = Declined
					}
					break
				}
			}

			sendWS(mUser.Conn, TRANSACTION_SHARE_ACCEPT, "response recorded")
			continue

		case START_TRANSACTION:
			var data struct {
				TransactionID string `json:"transaction_id"`
			}
			if err := mapstructure.Decode(msg.Data, &data); err != nil {
				sendWS(mUser.Conn, ERROR, "invalid data for START_TRANSACTION")
				continue
			}
			s.TransactionMu.Lock()
			defer s.TransactionMu.Unlock()

			tx, ok := s.Transactions[data.TransactionID]
			if !ok {
				sendWS(mUser.Conn, ERROR, "transaction not found")
				continue
			}

			if tx.Sender != mUser {
				sendWS(mUser.Conn, ERROR, "not authorized to start this transaction")
				continue
			}

			var acceptedTargets []*TransactionTarget
			for _, target := range tx.Targets {
				if target.Status == Accepted {
					acceptedTargets = append(acceptedTargets, target)
				}
			}
			tx.Targets = acceptedTargets
			tx.Started = true

			payload := struct {
				TransactionID string      `json:"transaction_id"`
				Sender        string      `json:"sender"`
				Files         []*FileInfo `json:"files"`
			}{
				TransactionID: tx.ID,
				Sender:        tx.Sender.MinUser.Username,
				Files:         tx.Files,
			}

			for _, target := range tx.Targets {
				sendWS(target.User.Conn, START_TRANSACTION, payload)
			}
			sendWS(mUser.Conn, START_TRANSACTION, "transaction started")
			continue
		case WEBRTC_SIGNAL:
			var signal WebRTCSignal
			if err := mapstructure.Decode(msg.Data, &signal); err != nil {
				sendWS(mUser.Conn, ERROR, "invalid data for START_TRANSACTION")
				continue
			}
			var targetUser *ManagedUser
			s.MUserMu.RLock()
			for _, user := range s.MUser {
				if user.User.PublicKey == signal.TargetKey {
					targetUser = user
					break
				}
			}
			s.MUserMu.RUnlock()
			if targetUser == nil {
				sendWS(mUser.Conn, ERROR, "target user not found or not connected")
				continue
			}
			sendWS(targetUser.Conn, WEBRTC_SIGNAL, struct {
				TransactionID string `json:"transaction_id"`
				FromKey       string `json:"from_key"`
				Data          any    `json:"data"`
			}{
				TransactionID: signal.TransactionID,
				FromKey:       mUser.User.PublicKey,
				Data:          signal.Data,
			})
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
