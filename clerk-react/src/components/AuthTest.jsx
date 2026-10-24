import { useState } from "react"
import { useAuth } from "@clerk/clerk-react"

export default function AuthTest() {
    const { userId, getToken } = useAuth()
    const [result, setResult] = useState("")

    async function testAuth() {

        try {
            const token = await getToken();

            if (!token) {
                setResult("Please sign in first")
                retunr;
            }

            const response = await fetch("http://127.0.0.1:8000/debug-auth", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            })

            const data = await response.json();
            setResult(JSON.stringify(data))
        } catch (error) {
            setResult("Error: " + error.message)
        }
    }

    return (
        <div>
            <button onClick={testAuth}>
                Test Auth
            </button>
            <pre>{result}</pre>
        </div>
    )
}