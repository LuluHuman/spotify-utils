"use client";

import { Spotify } from "@/lib/api";
import { User, UserProfile } from "@/lib/types";
import Image from "next/image";
import { useState } from "react";

export default function Login() {
	const [token, setToken] = useState<string>("");
	const [user, setUser] = useState<UserProfile>();
	const [error, setError] = useState<string>();
	function onClick() {
		fetch("/api/session", {
			method: "POST",
			body: JSON.stringify({ session: token }),
		}).then(() => {
			const stf = new Spotify();
			stf.addReadyListener(async () => {
				if (stf.session.err) {
					if (stf.session.err.status == 401)
						return setError("Invalid Token - Bad request");
					return setError("HTTP Error: " + stf.session.err.message);
				}

				if (stf.session.isAnonymous) return setError("Invalid Token - You are anonymous");

				const User = await stf.getMe();
				setUser(User);
				setTimeout(() => (window.location.href = "/"), 3000);
			});
		});
		return;
	}

	return (
		<div
			style={{
				background: "linear-gradient(#2c2c2c 0%, rgb(0, 0, 0) 100%)",
			}}
			className="w-screen h-screen fixed flex justify-center">
			<div className="bg-[#121212] text-white flex flex-col items-center justify-center md:w-fit md:px-52 px-8 py-8 md:rounded-2xl w-full h-fit m-8">
				{user ? (
					<>
						<h1 className="font-bold text-2xl mb-8">Logged in as</h1>
						<Image
							className="rounded-full size-12"
							width={user.data.me.profile.avatar.sources[1].width}
							height={user.data.me.profile.avatar.sources[1].height}
							unoptimized={true}
							src={user.data.me.profile.avatar.sources[1].url}
							alt="User Image"
						/>
						<span className="mb-8">{user.data.me.profile.name}</span>

						<button className="bg-[#1ed760] text-[#121212] font-bold text-base px-8 py-2 my-4 rounded-full">
							Redirecting...
						</button>
					</>
				) : (
					<>
						<h1 className="font-bold text-3xl mb-8">Log in from sp_dc token</h1>
						<label
							htmlFor="login-token"
							className="mb-2 font-bold">
							sp_dc token
						</label>
						<input
							className={`p-3 outline rounded-sm ${error ? "outline-red-600" : ""}`}
							type="password"
							id="login-token"
							placeholder="AQAeje8rLNz8LlCJejYHri28fULhcAeKLzglQtASdDmUsKYY-lighoIHpouiy_OjhpoHUPobpOUHpiuGoiygfKjhg"
							name="token"
							value={token}
							onInput={(e) => {
								const v = (e.target as HTMLInputElement).value;
								setToken(v);
							}}
						/>
						{error && <span className="text-red-500">(!) {error}</span>}
						<button
							className="bg-[#1ed760] text-[#121212] font-bold text-base px-8 py-2 my-4 rounded-full"
							type="submit"
							onClick={onClick}>
							Log in
						</button>
					</>
				)}
			</div>
		</div>
	);
}
