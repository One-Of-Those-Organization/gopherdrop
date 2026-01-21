package server

import (
	"github.com/gofiber/websocket/v2"
	"github.com/google/uuid"
	"github.com/mitchellh/mapstructure"
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
	// NOTE: sended by the client to give the server context what file is being sended on the transaction
	FILE_SHARE_TARGET // 6
	// NOTE: sended by the server to all transaction recv to give them the sender webrtc addres(for p2p)
	START_TRANSACTION // 7
	FILE_SHARE_ACCEPT // 8
	FILE_DATA         // 9
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
			// TODO: will be changed later
		case USER_SHARE_TARGET:
			var data struct {
				PublicKey []string `json:"public_keys"`
			}

			if err := mapstructure.Decode(msg.Data, &data); err != nil {
				sendWS(mUser.Conn, ERROR, "invalid data for USER_SHARE_TARGET")
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

			txID := uuid.New().String()
			transaction := &Transaction{
				ID:      txID,
				Sender:  mUser,
				Targets: targets,
			}

			s.TransactionMu.Lock()
			s.Transactions[txID] = transaction
			s.TransactionMu.Unlock()

			// Notify targets
			for _, target := range targets {
				sendWS(target.User.Conn, FILE_SHARE_ACCEPT, struct {
					TransactionID string `json:"transaction_id"`
					Sender        string `json:"sender"`
				}{
					TransactionID: txID,
					Sender:        mUser.MinUser.Username,
				})
			}

			sendWS(mUser.Conn, USER_SHARE_TARGET, txID)
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
		case FILE_SHARE_ACCEPT:
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

			sendWS(mUser.Conn, FILE_SHARE_ACCEPT, "response recorded")
			continue

		// NOTE: not done yet but impl the transaction rejected stuff
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
