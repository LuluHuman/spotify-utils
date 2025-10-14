"use client";

import React, { RefObject, useEffect, useRef, useState } from "react";
import { useSession } from "../layout";
import { useRouter } from "next/navigation";
import { PlayerState, SongState, SongStateExtra, SpotifyWebhook } from "@/lib/types";
import { collectState, collectStateExtra } from "@/lib/collectState";
import { URIto } from "@/lib/api";
import Image from "next/image";
import QueueView from "./Queue";
import { findLyrics } from "@/lib/lyricFinder";
import { Musixmatch } from "@/lib/Musixmatch";
import LyricView, { LyricsState } from "./Lyrics";

export default function Player() {
	const router = useRouter();

	const { SpotifyClient } = useSession();
	const mxmClient = useRef<Musixmatch | undefined>(undefined);

	const [state, setPlayerState] = useState<SpotifyWebhook["payloads"][0]["cluster"]>();
	const [trackState, setTrackState] = useState<SongState>();
	const [trackExtraState, setTrackExtraState] = useState<SongStateExtra>();

	const [message, setMessage] = useState<string | undefined>();
	const [lyrcs, setLyrics] = useState<LyricsState>();
	const [transcript, setTranscript] = useState<string>();

	const [pannelOpen, setPannelOpen] = useState<number>(0);

	//! Timekeeper
	const [isPaused, setIsPaused] = useState<boolean>(true);
	const [startTimestamp, setStartTimestamp] = useState<number>(0);
	const curDurationMs = useRef<number>(0);
	const currentInveral = useRef<number>(0);

	const lastSong = useRef<string>("");

	useEffect(() => {
		if (!SpotifyClient) return;
		mxmClient.current = new Musixmatch();
		setMessage("Connecting to Webhook...");

		SpotifyClient.addReadyListener(() => {
			if (!SpotifyClient.session.accessToken)
				return setMessage("Error: No Spotify Access Token");
			if (SpotifyClient.session.isAnonymous) {
				router.push("/login");
				return;
			}
			setMessage(undefined);
			const wsDealer = "dealer.spotify.com";
			const wsUrl = `wss://${wsDealer}/?access_token=${SpotifyClient.session.accessToken}`;
			const spWs = new WebSocket(wsUrl);
			spWs.onmessage = (event) => {
				const data = JSON.parse(event.data) as SpotifyWebhook;
				if (!data.headers) return;

				const stfConnectionId = data.headers["Spotify-Connection-Id"];
				if (!stfConnectionId) return setPlayerState(data.payloads[0].cluster);

				SpotifyClient.connectWs(stfConnectionId).then((state) => {
					console.info("Successfully connect to websocket");
					setPlayerState(state);
				});
			};
		});
	}, [SpotifyClient, router]);

	useEffect(() => {
		if (currentInveral.current) clearInterval(currentInveral.current);
		console.log(state);

		const player_state = (state?.player_state || state) as PlayerState;

		if (!SpotifyClient || !player_state || !state || !player_state.track) return;
		SpotifyClient.session.activeDeviceId = state?.active_device_id;

		if (player_state.track.metadata["media.manifest"]) {
			const transcript: string[] = [];

			const outro = decodeBase64(player_state.track.metadata["media.manifest"]);
			transcript.push(filterTags(outro) || "");

			const nextSong = player_state.next_tracks[0];
			if (nextSong?.metadata) {
				const nextSongMeta = nextSong?.metadata;
				if (nextSongMeta["media.manifest"]) {
					const intro = decodeBase64(nextSongMeta["media.manifest"]);
					transcript.push(filterTags(intro) || "");
				}

				if (nextSongMeta["narration.intro.ssml"]) {
					const intro = nextSongMeta["narration.intro.ssml"];
					transcript.push(filterTags(intro) || "");
				}
			}

			setTranscript(transcript.join("\n"));
			setLyrics(undefined);
		}

		const trackId = URIto.id(player_state.track.uri);

		const songDuration = parseInt(player_state.duration);
		curDurationMs.current = songDuration;

		const timestamp = parseInt(player_state.timestamp);
		const latency = performance.timeOrigin + performance.now() - timestamp;

		const ms = parseInt(player_state.position_as_of_timestamp);
		const startTimestamp = timestamp - ms + (latency > 1000 ? 0 : latency);
		setStartTimestamp(startTimestamp);
		setIsPaused(player_state.is_paused);

		if (lastSong.current == trackId) return;
		lastSong.current = trackId;

		SpotifyClient.getColors(player_state.track.metadata.image_xlarge_url).then(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(fetchColours: any) => {
				const Colors = fetchColours?.data
					? fetchColours.data.extractedColors[0]
					: undefined;
				const [dark, light] = Colors
					? [Colors.colorDark.hex, Colors.colorLight.hex]
					: ["", ""];
				document.body.style.setProperty("--dark-color", dark);
				document.body.style.setProperty("--light-color", light);
			}
		);

		collectState(trackId, SpotifyClient, state).then((changedState) => {
			setTrackState(changedState);

			// findLyrics(
			// 	{ SpotifyClient, mxmClient: mxmClient?.current },
			// 	{
			// 		uri: changedState.uris.song,
			// 		title: changedState.original_title || changedState.title,
			// 		artist: changedState.artist,
			// 	}
			// 	// eslint-disable-next-line @typescript-eslint/no-explicit-any
			// ).then(({ source, type, data, copyright }: any) => {
			// 	setTranscript(undefined);
			// 	if (data == "not-found") return setLyrics(undefined);

			// 	// * For ts Calibration
			// 	// * Violation error wouls occur
			// 	setTimeout(() => {
			// 		if (!player_state.is_paused) SpotifyClient.playback("resume");
			// 	}, 5000);
			// 	const cpyAttribute = copyright ? "\n" + copyright : "";
			// 	setLyrics({
			// 		data,
			// 		lyricType: type,
			// 		lyrSource: source,
			// 		lyrCopyright: cpyAttribute,
			// 		forSongId: trackId,
			// 	});
			// });
		});

		collectStateExtra(SpotifyClient, state).then((changedState: SongStateExtra) => {
			console.log(changedState);

			setTrackExtraState(changedState);
		});
	}, [state, SpotifyClient]);

	return (
		<div
			className="p-2 bg-[#121212] text-white w-full flex flex-col overflow-scroll"
			style={{ height: "calc(100vh - 3.5rem)" }}>
			<div className="flex-[1] h-full overflow-scroll flex">
				<div
					className={
						"h-full overflow-y-scroll overflow-x-hidden flex flex-col flex-[1] px-2 *:my-2 " +
						(pannelOpen == 0 ? "" : "hidden w-full md:w-fit md:flex")
					}
					ref={(ref) =>
						lyricController(
							ref,
							lyrcs,
							startTimestamp,
							currentInveral,
							isPaused || !state?.active_device_id
						)
					}>
					{lyrcs?.data ? (
						trackState?.id == lyrcs.forSongId && <LyricView lyrics={lyrcs} />
					) : (
						<>{transcript || "No lyrics found"}</>
					)}
				</div>

				<div
					className={
						"h-full overflow-y-scroll overflow-x-hidden md:w-96 w-full " +
						(pannelOpen == 1 ? "" : "hidden md:block")
					}
					onClick={(e) => {
						const button = e.target as HTMLButtonElement;

						const active_device_id = SpotifyClient?.session.activeDeviceId;
						const uri = button?.getAttribute("uri");
						const uid = button?.getAttribute("uid");

						if (!active_device_id || !uri || !uid) return;
						return SpotifyClient?.SkipTo({ active_device_id, uri, uid });
					}}>
					<QueueView
						curInfo={trackState}
						curInfoExtra={trackExtraState}
					/>
				</div>
			</div>
			<div className="bg-[var(--dark-color)] rounded-2xl overflow-hidden">
				<div className="flex gap-2 p-2 items-center">
					<Image
						className="size-10"
						unoptimized={true}
						width={64}
						height={64}
						alt="album cover"
						src={trackState?.image || "data:image/jpeg;base64"}
					/>
					<div className="flex flex-col justify-center *:line-clamp-1">
						<span className="font-bold">{trackState?.title || "Unknown Title"}</span>
						<span className="text-neutral-300 line-clamp-1">
							{message || trackState?.artist || "Unknown Artist"}
						</span>
					</div>
				</div>
				<ProgBar
					isPaused={isPaused}
					startTimestamp={startTimestamp}
					curDurationMs={curDurationMs}
				/>
			</div>
			<div className="w-full p-3 md:hidden">
				<ol className="flex justify-evenly">
					<li className={pannelOpen == 0 ? "text-white" : "text-neutral-500"}>
						<button onClick={() => setPannelOpen(0)}>Lyrics</button>
					</li>
					<li className={pannelOpen == 1 ? "text-white" : "text-neutral-500"}>
						<button onClick={() => setPannelOpen(1)}>Queue</button>
					</li>
				</ol>
			</div>
		</div>
	);
}

function filterTags(speak: string) {
	const speakTagPattern = /<speak[^>]*>([\s\S]*?)<\/speak>/;
	const match = speak.match(speakTagPattern);
	return match ? match[1].replace(/<entity[^>]*>(.*?)<\/entity>/g, "$1") : undefined;
}

function decodeBase64(base64: string) {
	const binary = atob(base64); // Decode base64 into Latin-1 binary string
	const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0)); // Convert to bytes
	const decoder = new TextDecoder("utf-8"); // Use UTF-8 decoder
	return decoder.decode(bytes); // Decode bytes properly as UTF-8 string
}

function ProgBar({
	isPaused,
	startTimestamp,
	curDurationMs,
}: {
	isPaused: boolean;
	startTimestamp: number;
	curDurationMs: RefObject<number>;
}) {
	return (
		<div className="w-full overflow-hidden">
			<div
				ref={(ref) => {
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const w = window as any;
					if (w.progInt) clearInterval(w.progInt);
					w.progInt = setInterval(() => {
						if (isPaused) return clearInterval(w.progInt);
						const curProgressMs =
							performance.timeOrigin + performance.now() - startTimestamp;

						const progBarVal =
							Math.ceil((curProgressMs / curDurationMs.current) * 10000) / 100;

						ref?.setAttribute("style", `--w-prog: ${progBarVal}%;`);
					}, 500);
				}}
				className={`bg-white h-1 w-[var(--w-prog)] transition duration-1000`}></div>
		</div>
	);
}

const roundGrad = (p: number) => (p > 100 ? 100 : p < 0 ? 0 : Number.isNaN(p) ? 100 : p);
const getStartEnd = (element: HTMLSpanElement) => {
	const msStart = parseInt(element.getAttribute("start") || "-1");
	const msEnd = parseInt(element.getAttribute("end") || "-1");

	return [msStart, msEnd];
};
const classModVal = (
	element: HTMLSpanElement | HTMLButtonElement | HTMLDivElement,
	statement: boolean,
	className: string
) => {
	if (statement) return element.classList.add(className);

	const hasAdded = element.classList.contains(className);
	if (hasAdded) element.classList.remove(className);
	if (element.classList.length == 0) element.removeAttribute("class");
};

function lyricController(
	ref: HTMLDivElement | null,
	lyrcs: LyricsState | undefined,
	startTimestamp: number,
	currentInveral: React.RefObject<number>,
	shouldStop: boolean
) {
	const lines = ref?.children;

	const id = Math.floor(Math.random() * 10000);
	currentInveral.current = id;
	requestAnimationFrame(() => frame(id));
	function frame(id: number) {
		const ms = performance.timeOrigin + performance.now() - startTimestamp;
		const curMs = Math.floor(ms / 10) * 10;
		if (shouldStop || currentInveral.current != id) return;

		if (!lines) return;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i] as HTMLSpanElement;

			const [msStart, msEnd] = getStartEnd(line);

			const isInstrumental = line.classList.contains("instrumental");
			const isBackground = line.classList.contains("bg");
			const isSyllable = lyrcs?.lyricType == "Syllable";

			const inRange = curMs >= msStart && !(curMs >= msEnd);
			const inCloseRange = msStart - curMs < 200 && msStart - curMs > 0;

			if (!isBackground && inCloseRange)
				line?.scrollIntoView({ block: "center", behavior: "smooth" });

			classModVal(line, inRange, "lineActive");
			if (!inRange) continue;

			if (isSyllable) {
				const sylElements = line.children;

				for (let i = 0; i < sylElements.length; i++) {
					const sylElement = sylElements[i] as HTMLSpanElement;

					const [msStart, msEnd] = getStartEnd(sylElement);

					const startOffset = curMs - msStart;
					const endOffset = msEnd - msStart;
					const completePercentage = (startOffset / endOffset) * 100;

					const inSylRange = curMs >= msStart;

					const SYL_ACTIVE_TAG =
						lyrcs.lyrSource == "Musixmatch" ? "sylActiveMxM" : "sylActive";

					classModVal(sylElement, !inSylRange, "sylInactive");
					classModVal(sylElement, inSylRange && completePercentage < 100, SYL_ACTIVE_TAG);

					const perc = roundGrad(completePercentage);
					if (perc > 0 && perc != 100)
						sylElement.setAttribute("style", `--gradient-progress: ${perc}%;`);
					else sylElement.removeAttribute("style");
				}
			}

			if (isInstrumental) {
				const dotsParent = line.children[0] as HTMLSpanElement;
				const dots = dotsParent.children;

				const activeEnd = msEnd - msStart;
				const timeLeft = msEnd - curMs;

				const endingTime = ((activeEnd - 1000) % 2) + 1000;
				const actveStart = curMs - msStart;
				const durInsPer = actveStart / (activeEnd - endingTime);

				for (let i = 0; i < dots.length; i++) {
					const dot = dots[i] as HTMLSpanElement;

					const startAt = i / 3;
					const alphaSigma = durInsPer >= startAt ? durInsPer : 0;
					dot.setAttribute("style", `--alpha: ${alphaSigma};`);
				}

				const animEnded = timeLeft < endingTime;
				dotsParent.classList[animEnded ? "add" : "remove"]("animation-end");
				dotsParent.classList[animEnded ? "remove" : "add"]("animation");
			}
		}

		requestAnimationFrame(() => frame(id));
	}
}
