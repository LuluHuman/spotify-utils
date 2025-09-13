/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import axios from "axios";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "../layout";
import { useRouter, useSearchParams } from "next/navigation";

export default function TrackInfo() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const queryId = searchParams.get("id");

	const { SpotifyClient } = useSession();
	const [token, setToken] = useState<string>();
	const [id, setId] = useState<string>(queryId || "0laMYIfB9WohTEOTjG6RDz");
	const [data, setData] = useState<any>();
	const [images, setImages] = useState<{ url: string; size: number }[]>();

	const search = useCallback(
		() =>
			axios
				.get("/api/search?id=" + id, { headers: { Authorization: "Bearer " + token } })
				.then((res) => {
					const d = res.data;
					setData(d);
				}),
		[id, token]
	);

	useEffect(() => {
		SpotifyClient?.addReadyListener(() => {
			setToken(SpotifyClient.session.accessToken);
			if (queryId && token) search();
		});
	}, [SpotifyClient, search, queryId, token]);

	function onClick() {
		router.replace("/track-info?id=" + id);
		search();
	}
	const { day, month, year } = data ? data.metaAlbum.date : {};
	const earliest_live_album = data
		? new Date(data?.metaAlbum.earliest_live_timestamp * 1000).toLocaleString("en-GB", {
				dateStyle: "short",
		  })
		: "";

	const earliest_live_track = data
		? new Date(data?.metaTrack.earliest_live_timestamp * 1000).toLocaleString("en-GB", {
				dateStyle: "short",
		  })
		: "";
	return (
		<div
			onClick={(e) => {
				if (!e.target) return;

				const element = e.target as HTMLParagraphElement;
				if (!element.classList) return;

				const isCopyable = element.classList.contains("copyable");
				if (!isCopyable) return;
				navigator.clipboard.writeText(element.textContent);

				const toast = document.createElement("span");
				toast.textContent = "Copied";
				toast.style = `position: absolute; left:${e.pageX}px; top:${e.pageY}px; background-color: #cbf55c; color: #290a50; padding: 2px 10px; border-radius: 10px`;
				document.body.appendChild(toast);

				setTimeout(() => {
					toast.remove();
				}, 500);
			}}>
			<search className="Search">
				<label htmlFor="track-id">Id</label>
				<input
					type="search"
					id="track-id"
					placeholder="0laMYIfB9WohTEOTjG6RDz"
					name="id"
					value={id}
					onInput={(e) => {
						const v = (e.target as HTMLInputElement).value;
						if (v.startsWith("http")) {
							const val = v.split("open.spotify.com/track/");
							if (!val[1]) return setId(v);
							setId(val[1].split("?")[0]);
							return;
						}
						setId(v);
					}}
				/>
				<button
					type="submit"
					onClick={onClick}>
					Get track info
				</button>
			</search>

			{images && (
				<div className="fixed left-0 right-0 bg-[#000000aa] w-screen h-screen text-white">
					<h1 className="w-full text-3xl text-center font-bold my-4">Images</h1>
					<div className="flex items-end overflow-scroll w-screen">
						{images
							.sort((a, b) => b.size - a.size)
							.map((im, i) => {
								return (
									<div key={i}>
										<Image
											className="mr-3 max-w-fit"
											src={im.url}
											alt={`alb img (${im.size})`}
											width={im.size}
											height={im.size}
											unoptimized={true}
										/>
										<p className="w-full text-center">{im.size}</p>
									</div>
								);
							})}
					</div>

					<button onClick={() => setImages(undefined)}>close</button>
				</div>
			)}

			{data && (
				<article>
					<div className="flex flex-wrap m-3">
						<h1 className="w-full text-3xl text-center font-bold">Album Info</h1>
						<div className="flex items-center">
							<Image
								onClick={() => {
									setImages(
										data.metaAlbum.cover_group.image.map((i: any) => ({
											url: "https://i.scdn.co/image/" + i.file_id,
											size: i.width,
										}))
									);
								}}
								className="mr-3"
								src={
									"https://i.scdn.co/image/" +
									data.metaAlbum.cover_group.image[0].file_id
								}
								alt="alb img"
								width={data.metaAlbum.cover_group.image[0].width}
								height={data.metaAlbum.cover_group.image[0].height}
								unoptimized={true}
							/>
						</div>
						<div className=" *:my-2 flex-[1]">
							<p>
								<span className="value"> {data.metaAlbum.type}</span>
							</p>
							<div>
								<p className="text-2xl copyable">{data.metaAlbum.name}</p>
							</div>
							{data.metaAlbum.name != data.metaAlbum.original_title && (
								<p>
									<span className="label">Original Title</span>
									<span className="copyable">
										{data.metaAlbum.original_title}
									</span>
								</p>
							)}
							<p>
								<span className="label">Artist</span>
								{data.metaAlbum.artist.map((a: any, i: number) => (
									<span
										key={i}
										className="copyable">
										{a.name}
									</span>
								))}
							</p>
							<p>
								<span className="label">Released on</span>
								<span className="copyable">{day}</span>
								<span className="copyable">{month}</span>
								<span className="copyable">{year}</span>
							</p>
							<p>
								<span className="label">Released to stream</span>
								<span className="value"> {earliest_live_album}</span>
							</p>

							<p>
								<span className="label">Label</span>
								<span className="copyable">{data.metaAlbum.label}</span>
							</p>

							<div>
								<p className="label">Copyright</p>
								{data.metaAlbum.copyright.map(
									(c: { type: "C" | "P"; text: string }, i: number) => (
										<p
											key={i}
											className="copyable">
											{(c.type == "C" ? "©" : "℗") + c.text}
										</p>
									)
								)}
							</div>
							<p>
								<span className="label">URI</span>
								<span className="value">{data.metaAlbum.canonical_uri}</span>
							</p>
						</div>
					</div>

					<div className="flex flex-wrap m-3">
						<h1 className="w-full text-3xl text-center font-bold">Track Info</h1>
						<div className=" *:my-2 flex-[1]">
							<div>
								<p className="text-2xl copyable">{data.metaTrack.name}</p>
							</div>
							{data.metaTrack.name != data.metaTrack.original_title && (
								<p>
									<span className="label">Original Name</span>
									<span className="copyable">
										{data.metaTrack.original_title}
									</span>
								</p>
							)}
							<p>
								<span className="label">Artist</span>
								{data.metaTrack.artist.map((a: any, i: number) => (
									<span
										key={i}
										className="copyable">
										{a.name}
									</span>
								))}
							</p>

							<p>
								<span className="label">Duration</span>
								<span className="value">{msToMinSec(data.metaTrack.duration)}</span>
							</p>
							<p>
								<span className="label">Track No</span>
								<span className="copyable">{data.metaTrack.number}</span>of
								<span className="copyable">{data.track.album.total_tracks}</span>
							</p>
							<p>
								<span className="label">Released to stream</span>
								<span className="value"> {earliest_live_track}</span>
							</p>

							<p>
								<span className="label">Language</span>
								<span className="value">
									{data.metaTrack.language_of_performance}
								</span>
							</p>
							<p>
								<span className="label">URI</span>
								<span className="value">{data.metaTrack.canonical_uri}</span>
							</p>
						</div>
					</div>
				</article>
			)}
		</div>
	);
}

function msToMinSec(ms: number) {
	const secTotal = ms / 1000;
	const min = Math.floor(secTotal / 60);
	const sec = Math.floor((secTotal / 60 - min) * 60);
	// return ms;
	return min + ":" + sec;
}
