package server

type WSType int

const (
	NONE WSType = iota
	CONFIG_DISCOVERABLE
)

type WSMessage struct {
	WSType    WSType `json:"type"`
	Data      any    `json:"data"`
}

func HandleWS(s *Server, mUser *ManagedUser) {
    for {
        var msg WSMessage
        if err := mUser.Conn.ReadJSON(&msg); err != nil {
            break
        }

        switch msg.WSType {
        case CONFIG_DISCOVERABLE:
        }
    }
}
