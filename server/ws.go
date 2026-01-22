package server

import (
	"log"
)

func HandleWS(s *Server, user *ManagedUser) {
	// TODO: Implement WebSocket message handling logic
	log.Printf("Handling WS for user: %s", user.MinUser.Username)

	// Keep connection open and read messages (stub)
	for {
		_, _, err := user.Conn.ReadMessage()
		if err != nil {
			log.Println("WS Error:", err)
			break
		}
		// Process message...
	}
}

func CacheDiscoverableUser(s *Server) {
	s.MUserMu.Lock()
	defer s.MUserMu.Unlock()

	// TODO: Populate CachedUser from DB or active connections
	// For now, just rebuild from active MUser
	s.CachedUser = make([]MinimalUser, 0, len(s.MUser))
	for _, muser := range s.MUser {
		if muser.User.IsDiscoverable {
			s.CachedUser = append(s.CachedUser, muser.MinUser)
		}
	}
}

func AddCachedUser(s *Server, user *ManagedUser) {
	// Simple append for now
	if user.User.IsDiscoverable {
		s.CachedUser = append(s.CachedUser, user.MinUser)
	}
}

func DelCachedUser(s *Server, id uint) {
	// Remove user from CachedUser
	for range s.CachedUser {
		// Verify how to match. MinimalUser doesn't have ID.
		// Retrying with check against username or public key for now,
		// but the signature asks for `id uint`.
		// Let's iterate `s.MUser` to find the one matching ID since MinimalUser doesn't have it?
		// Or just ignore for now as this is a stub.
		// Actually, `MinimalUser` has PublicKey.
		// But the function receives `id uint` (gorm model ID).
		// We probably need to pass `user.User` or something.
		// For now, let's just re-cache everything aka brute force refresh.
		// It's safer.
	}
	CacheDiscoverableUser(s)
}
