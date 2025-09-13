/* eslint-disable @next/next/no-sync-scripts */
"use client";

import Link from "next/link";
import "./globals.css";
import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Spotify } from "@/lib/api";

const menuEntries: { [key: string]: string } = {
	"/track-info": "Track Info",
	"/top": "Charts",
	"/player": "Player",
};

const SpotifyContext = createContext<{
	SpotifyClient: Spotify | undefined;
	setSpotifyClient: React.Dispatch<React.SetStateAction<Spotify | undefined>>;
}>({
	SpotifyClient: undefined,
	setSpotifyClient: () => {},
});

export const useSession = () => useContext(SpotifyContext);
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const [SpotifyClient, setSpotifyClient] = useState<Spotify>();
	const [menuOpened, setMenuOpened] = useState<boolean>(false);

	const [username, setUsername] = useState<string>();

	useEffect(() => {
		const stfClient = new Spotify();
		if (!stfClient) return;
		stfClient.addReadyListener(() => {
			if (!stfClient.session.accessToken) return alert("Error: No Spotify Access Token");
			if (stfClient.session.isAnonymous) return setUsername(undefined);
			stfClient.getMe().then((me) => {
				setUsername(me.display_name);
			});
			// const wsDealer = "dealer.spotify.com";
			// const wsUrl = `wss://${wsDealer}/?access_token=${SpotifyClient.session.accessToken}`;
			// const spWs = new WebSocket(wsUrl);
			// spWs.onmessage = (event) => {
			// 	const data = JSON.parse(event.data) as SpotifyWebhook;
			// 	if (!data.headers) return;
			// 	const stfConnectionId = data.headers["Spotify-Connection-Id"];
			// 	if (!stfConnectionId) return setPlayerState(data.payloads[0].cluster);
			// 	SpotifyClient.connectWs(stfConnectionId).then((state) => {
			// 		console.info("Successfully connect to websocket");
			// 		setPlayerState(state);
			// 	});
			// };
		});
		setSpotifyClient(stfClient);
	}, []);

	return (
		<html lang="en">
			<body>
				<header className="flex justify-between bg-[#400073] text-white p-3 items-center">
					<Link
						className="text-2xl font-bold"
						href="/">
						Spotify Utils
					</Link>

					<div className="md:block hidden">
						<TopBar menuEntries={menuEntries} />
					</div>

					<div className="flex justify-center">
						{username ? (
							<span className="font-bold">{username}</span>
						) : (
							<Link
								className="font-bold"
								href={"/login"}>
								Log In
							</Link>
						)}
						<button
							className="px-2 font-bold md:hidden"
							onClick={() => setMenuOpened((v) => !v)}>
							☰
						</button>
					</div>
				</header>
				<header
					className={`bg-[#400073] text-white p-3 md:hidden *:flex-col *:w-full *:items-center ${
						menuOpened ? "" : "hidden"
					}`}>
					<TopBar menuEntries={menuEntries} />
				</header>
				<SpotifyContext.Provider value={{ SpotifyClient, setSpotifyClient }}>
					{children}
				</SpotifyContext.Provider>
			</body>
		</html>
	);
}

function TopBar({ menuEntries }: { menuEntries: { [key: string]: string } }) {
	const pathname = usePathname();

	return (
		<ol className="flex gap-2">
			{Object.keys(menuEntries).map((path, i) => {
				return (
					<li
						key={i}
						className={path == pathname ? "text-[#CBF55C]" : undefined}>
						<Link
							href={path}
							className="font-bold">
							{menuEntries[path]}
						</Link>
					</li>
				);
			})}
		</ol>
	);
}
