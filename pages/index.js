import Head from "next/head";
import ChatUI from "../components/ChatUI"; // asigură-te că fișierul e ChatUI.js

export default function Home() {
  return (
    <>
      <Head>
        <title>Target Zero Chat Assistant</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <ChatUI />
    </>
  );
}
