package server

import (
	"time"

	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
	"github.com/mitchellh/mapstructure"
)

type WSType int

const (
	NONE  WSType = iota // 0
	ERROR               // 1

	CONFIG_DISCOVERABLE // 2

	START_SHARING   // 3
	USER_SHARE_LIST // 4

	NEW_TRANSACTION    // 5
	INFO_TRANSACTION   // 6
	DELETE_TRANSACTION // 7

	USER_SHARE_TARGET // 8
	FILE_SHARE_TARGET // 9

	START_TRANSACTION        // 10
	TRANSACTION_SHARE_ACCEPT // 11
	WEBRTC_SIGNAL            // 12

	USER_INFO             // 13
	CONFIG_NAME           // 14
	TRANSACTION_HOST_RECV // 15
)

type WSMessage struct {
	WSType WSType `json:"type"`
	Data   any    `json:"data"`
}

type WebRTCSignal struct {
	TransactionID string `json:"transaction_id" mapstructure:"transaction_id"`
	TargetKey     string `json:"target_key" mapstructure:"target_key"`
	Data          any    `json:"data" mapstructure:"data"`
}

// Menggunakan WriteMu dari Server untuk mencegah Concurrent Write Panic
func sendWS(s *Server, c *websocket.Conn, t WSType, data any) {
	s.WriteMu.Lock()
	_ = c.WriteJSON(WSMessage{
		WSType: t,
		Data:   data,
	})
	s.WriteMu.Unlock()
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
		// --- FITUR BARU DARI FRONTEND FRIEND ---
		case CONFIG_NAME:
			newname, ok := msg.Data.(string)
			if !ok {
				sendWS(s, mUser.Conn, ERROR, "invalid websocket message")
				continue
			}
			var user User
			res := s.DB.Where("public_key = ?", mUser.User.PublicKey).First(&user).Error
			if res != nil {
				sendWS(s, mUser.Conn, ERROR, "invalid public key")
				continue
			}
			user.Username = newname
			res = s.DB.Save(&user).Error
			if res != nil {
				sendWS(s, mUser.Conn, ERROR, "db failed to save your changes")
				continue
			}

			// Update cache di memori
			s.CachedUserMu.Lock()
			for _, user := range s.CachedUser {
				if user.User.PublicKey == mUser.User.PublicKey {
					s.MUserMu.Lock()
					user.MinUser.Username = newname
					user.User.Username = newname
					s.MUserMu.Unlock()
					break
				}
			}
			s.CachedUserMu.Unlock()
			sendWS(s, mUser.Conn, CONFIG_NAME, "success")
			continue

		case USER_INFO:
			sendWS(s, mUser.Conn, USER_INFO, mUser.User)
			continue

		// --- LOGIKA UTAMA (MERGE BACKEND + FRONTEND) ---
		case CONFIG_DISCOVERABLE:
			n, ok := msg.Data.(bool)
			if !ok {
				sendWS(s, mUser.Conn, ERROR, "invalid websocket message")
				continue
			}
			var user User
			res := s.DB.Where("public_key = ?", mUser.User.PublicKey).First(&user).Error
			if res != nil {
				sendWS(s, mUser.Conn, ERROR, "invalid public key")
				continue
			}
			user.IsDiscoverable = n
			res = s.DB.Save(&user).Error
			if res != nil {
				sendWS(s, mUser.Conn, ERROR, "db failed to save your changes")
				continue
			}

			// PENTING: Pakai Logic Backend (Add/Del CachedUser) biar list user rapi
			s.CachedUserMu.Lock()
			if n == false {
				DelCachedUser(s, mUser.User.ID)
			} else {
				AddCachedUser(s, mUser)
			}
			s.CachedUserMu.Unlock()

			sendWS(s, mUser.Conn, CONFIG_DISCOVERABLE, "success")
			continue

		case START_SHARING:
			s.CachedUserMu.RLock()
			sendWS(s, mUser.Conn, USER_SHARE_LIST, s.CachedUser)
			s.CachedUserMu.RUnlock()
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
			sendWS(s, mUser.Conn, NEW_TRANSACTION, transaction)
			continue

		case INFO_TRANSACTION:
			n, ok := msg.Data.(string)
			if !ok {
				sendWS(s, mUser.Conn, ERROR, "invalid websocket message")
				continue
			}

			s.TransactionMu.RLock()
			if s.Transactions[n] == nil {
				sendWS(s, mUser.Conn, DELETE_TRANSACTION, n)
				s.TransactionMu.RUnlock()
				continue
			}
			sendWS(s, mUser.Conn, INFO_TRANSACTION, s.Transactions[n])
			s.TransactionMu.RUnlock()
			continue

		case DELETE_TRANSACTION:
			var valid bool = true
			n, ok := msg.Data.(string)
			if !ok {
				sendWS(s, mUser.Conn, ERROR, "invalid websocket message")
				continue
			}

			var target []*ManagedUser

			s.TransactionMu.Lock()

			if s.Transactions[n] != nil && mUser.MinUser.PublicKey == s.Transactions[n].Sender.MinUser.PublicKey {
				for _, user := range s.Transactions[n].Targets {
					target = append(target, user.User)
				}
				delete(s.Transactions, n)
			} else {
				valid = false
			}

			s.TransactionMu.Unlock()

			if valid {
				// Broadcast delete ke semua participant
				for _, t := range target {
					sendWS(s, t.Conn, DELETE_TRANSACTION, n)
				}
				sendWS(s, mUser.Conn, DELETE_TRANSACTION, n)
			}
			continue

		case USER_SHARE_TARGET:
			var data struct {
				TransactionID string   `mapstructure:"transaction_id"`
				PublicKey     []string `mapstructure:"public_keys"`
			}

			if err := mapstructure.Decode(msg.Data, &data); err != nil {
				sendWS(s, mUser.Conn, ERROR, "invalid data for USER_SHARE_TARGET")
				continue
			}

			s.TransactionMu.RLock()
			tx, exists := s.Transactions[data.TransactionID]
			s.TransactionMu.RUnlock()

			if !exists || tx == nil {
				sendWS(s, mUser.Conn, ERROR, "transaction not found or expired")
				continue
			}

			if mUser.User.PublicKey != tx.Sender.User.PublicKey {
				sendWS(s, mUser.Conn, ERROR, "not authorized to modify this transaction")
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
				sendWS(s, mUser.Conn, ERROR, "no valid target users found")
				continue
			}

			s.TransactionMu.Lock()
			if s.Transactions[data.TransactionID] != nil {
				s.Transactions[data.TransactionID].Targets = targets
			}
			s.TransactionMu.Unlock()

			// Notify targets
			s.TransactionMu.RLock()
			for _, target := range targets {
				sendWS(s, target.User.Conn, TRANSACTION_SHARE_ACCEPT, struct {
					Transaction *Transaction `json:"transaction"`
					Sender      string       `json:"sender"`
				}{
					Transaction: tx,
					Sender:      mUser.MinUser.Username,
				})
			}

			sendWS(s, mUser.Conn, USER_SHARE_TARGET, tx)
			s.TransactionMu.RUnlock()
			continue

		case FILE_SHARE_TARGET:
			var data struct {
				TransactionID string     `mapstructure:"transaction_id"`
				Files         []FileInfo `mapstructure:"files"`
			}
			if err := mapstructure.Decode(msg.Data, &data); err != nil {
				sendWS(s, mUser.Conn, ERROR, "invalid data for FILE_SHARE_TARGET")
				continue
			}

			if data.TransactionID == "" || len(data.Files) == 0 {
				sendWS(s, mUser.Conn, ERROR, "missing transaction_id or files")
				continue
			}

			s.TransactionMu.RLock()
			transaction, ok := s.Transactions[data.TransactionID]
			s.TransactionMu.RUnlock()

			if !ok {
				sendWS(s, mUser.Conn, ERROR, "transaction not found")
				continue
			}

			if transaction.Sender != mUser {
				sendWS(s, mUser.Conn, ERROR, "not authorized to modify this transaction")
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

			sendWS(s, mUser.Conn, FILE_SHARE_TARGET, "files added to transaction")
			continue

		case TRANSACTION_SHARE_ACCEPT:
			var data struct {
				TransactionID string `mapstructure:"transaction_id"`
				Accept        bool   `mapstructure:"accept"`
				Reason        string `mapstructure:"reason"`
			}
			if err := mapstructure.Decode(msg.Data, &data); err != nil {
				sendWS(s, mUser.Conn, ERROR, "invalid data for FILE_SHARE_ACCEPT")
				continue
			}

			s.TransactionMu.Lock()

			tx, ok := s.Transactions[data.TransactionID]
			if !ok {
				s.TransactionMu.Unlock()
				sendWS(s, mUser.Conn, ERROR, "transaction not found")
				continue
			}

			if tx.Started {
				s.TransactionMu.Unlock()
				sendWS(s, mUser.Conn, ERROR, "transaction has already started")
				continue
			}

			var targetFound bool
			var alreadyResponded bool
			for _, target := range tx.Targets {
				if target.User == mUser {
					targetFound = true
					if target.Status != Pending {
						alreadyResponded = true
						break
					}
					if data.Accept {
						target.Status = Accepted
					} else {
						target.Status = Declined
					}
					break
				}
			}

			if !targetFound {
				s.TransactionMu.Unlock()
				sendWS(s, mUser.Conn, ERROR, "you are not a target of this transaction")
				continue
			}

			if alreadyResponded {
				s.TransactionMu.Unlock()
				sendWS(s, mUser.Conn, TRANSACTION_SHARE_ACCEPT, "response already recorded")
				continue
			}

			sendWS(s, mUser.Conn, TRANSACTION_SHARE_ACCEPT, "response recorded")

			if data.Accept {
				sendWS(s, tx.Sender.Conn, TRANSACTION_SHARE_ACCEPT, struct {
					Type            string `json:"type"`
					Username        string `json:"username"`
					Accepted        bool   `json:"accepted"`
					TransactionID   string `json:"transaction_id"`
					SenderPublicKey string `json:"sender_public_key"`
				}{
					Type:            "accept_notification",
					Username:        mUser.MinUser.Username,
					Accepted:        true,
					TransactionID:   data.TransactionID,
					SenderPublicKey: mUser.MinUser.PublicKey,
				})

				// Fix Race Condition: Langsung start transaction buat user yang accept
				payload := struct {
					TransactionID string      `json:"transaction_id"`
					Sender        string      `json:"sender"`
					Files         []*FileInfo `json:"files"`
				}{
					TransactionID: tx.ID,
					Sender:        tx.Sender.MinUser.Username,
					Files:         tx.Files,
				}
				sendWS(s, mUser.Conn, START_TRANSACTION, payload)

			} else {
				sendWS(s, tx.Sender.Conn, TRANSACTION_SHARE_ACCEPT, struct {
					Type          string `json:"type"`
					Username      string `json:"username"`
					Declined      bool   `json:"declined"`
					TransactionID string `json:"transaction_id"`
					Reason        string `json:"reason,omitempty"`
				}{
					Type:          "decline_notification",
					Username:      mUser.MinUser.Username,
					Declined:      true,
					TransactionID: data.TransactionID,
					Reason:        data.Reason,
				})
			}
			s.TransactionMu.Unlock()
			continue

		case START_TRANSACTION:
			var data struct {
				TransactionID string `mapstructure:"transaction_id"`
			}
			if err := mapstructure.Decode(msg.Data, &data); err != nil {
				sendWS(s, mUser.Conn, ERROR, "invalid data for START_TRANSACTION")
				continue
			}
			s.TransactionMu.Lock()

			tx, ok := s.Transactions[data.TransactionID]
			if !ok {
				s.TransactionMu.Unlock()
				sendWS(s, mUser.Conn, ERROR, "transaction not found")
				continue
			}

			if tx.Sender != mUser {
				s.TransactionMu.Unlock()
				sendWS(s, mUser.Conn, ERROR, "not authorized to start this transaction")
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
				sendWS(s, target.User.Conn, START_TRANSACTION, payload)
			}
			sendWS(s, mUser.Conn, START_TRANSACTION, "transaction started")
			s.TransactionMu.Unlock()
			continue

		// --- FITUR BARU DARI FRONTEND FRIEND ---
		case TRANSACTION_HOST_RECV:
			var data struct {
				TransactionID string `mapstructure:"transaction_id"`
			}
			if err := mapstructure.Decode(msg.Data, &data); err != nil {
				sendWS(s, mUser.Conn, ERROR, "invalid data for TRANSACTION_HOST_RECV")
				continue
			}
			s.TransactionMu.Lock()

			tx, ok := s.Transactions[data.TransactionID]
			if !ok {
				s.TransactionMu.Unlock()
				sendWS(s, mUser.Conn, ERROR, "transaction not found")
				continue
			}

			if tx.Sender != mUser {
				s.TransactionMu.Unlock()
				sendWS(s, mUser.Conn, ERROR, "not authorized to get this transaction")
				continue
			}

			sendWS(s, mUser.Conn, TRANSACTION_HOST_RECV, tx.Targets)
			continue

		case WEBRTC_SIGNAL:
			var signal WebRTCSignal
			if err := mapstructure.Decode(msg.Data, &signal); err != nil {
				sendWS(s, mUser.Conn, ERROR, "invalid data for WEBRTC_SIGNAL")
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
				sendWS(s, mUser.Conn, ERROR, "target user not found or not connected")
				continue
			}
			sendWS(s, targetUser.Conn, WEBRTC_SIGNAL, struct {
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
