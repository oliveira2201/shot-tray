import axios from "axios";

const MSG_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2FybmFtZSI6IkZlbGlwZSBBcmHDumpvIGRlIEFsY8OibnRhcmEgT2xpdmVpcmEiLCJwcm9maWxlIjoiYWRtaW4iLCJpZCI6ODU0LCJjb21wYW55SWQiOjIyMywiaWF0IjoxNzcwODMyNTE4LCJleHAiOjE3NzM0MjQ1MTh9.1FmHc6lq87NUao9QnUaPcIdXuOIhOUK0gIeS8_tF2_w";
const BASE_URL = "https://api.shotzap.com.br";

async function testSendMessage() {
    console.log("Testando envio de mensagem com token antigo/msg...");
    try {
        await axios.post(`${BASE_URL}/messages/send-text`, {
            number: "5511999999999",
            body: "Teste de verificação de token",
            openTicket: "0"
        }, {
            headers: { Authorization: `Bearer ${MSG_TOKEN}` }
        });
        console.log("✅ MSG_TOKEN está válido para mensagens.");
    } catch (e: any) {
        console.log("❌ MSG_TOKEN falhou:", e.response ? e.response.data : e.message);
    }
}

testSendMessage();
