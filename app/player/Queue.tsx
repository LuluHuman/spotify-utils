import { NextTrack, SongState, SongStateExtra } from "../../lib/types";
import { Spotify } from "../../lib/api";
import Image from "next/image";

function Explicit() {
	return (
		<span className="size-4 inline-flex justify-center items-center py-[3px] px-[5px] bg-[rgba(255,255,255,.6)] rounded-sm text-[9px] text-black mx-[3px]">
			E
		</span>
	);
}

function Hidden() {
	return (
		<span className="h-4 inline-flex justify-center items-center py-[3px] px-[5px] bg-[rgba(255,255,255,.6)] rounded-sm text-[9px] text-black mx-[3px]">
			Hidden
		</span>
	);
}

function SongCard({
	albImg,
	title,
	artist,
	isExplicit,
	clickAction,
	hidden,
}: {
	albImg: string;
	title: string;
	artist: string;
	isExplicit: boolean;
	hidden: string;
	clickAction?: () => Promise<unknown> | undefined;
}) {
	return (
		<button
			className={"queueItem text-white w-full transition-all rounded-lg font-bold flex py-2"}
			onClick={clickAction}>
			<Image
				className="rounded-md size-12 mr-2 bg-[#282828]"
				alt="queue"
				width={64}
				height={64}
				unoptimized={true}
				src={albImg}
			/>
			<div className="flex flex-col justify-center text-nowrap text-ellipsis overflow-hidden">
				<span className="text-base text-left font-mediumz">
					{hidden == "true" ? <Hidden /> : <></>}
					{title}
				</span>
				<span className="flex items-center opacity-50 text-sm text-left">
					{isExplicit ? <Explicit /> : <></>}
					{artist}
				</span>
			</div>
		</button>
	);
}
export default function QueueView({
	curInfo,
	curInfoExtra,
	SpotifyClient,
}: {
	curInfo?: SongState;
	curInfoExtra?: SongStateExtra;
	SpotifyClient?: Spotify;
}) {
	if (!curInfo || !curInfoExtra || !curInfoExtra.queue) return <></>;

	const NowPlaying = [
		<div
			key={"title1"}
			className="font-bold">
			Now playing
		</div>,
		<SongCard
			albImg={curInfo.image}
			title={curInfo.original_title || curInfo?.title}
			artist={curInfo.artist}
			isExplicit={curInfo.isExplicit}
			hidden={"false"}
			key={"np"}
		/>,
	];

	const ProviderContext = curInfoExtra.queue.filter(({ provider }) => provider !== "queue");
	const ProviderQueue = curInfoExtra.queue.filter(({ provider }) => provider == "queue");
	const section = (q: NextTrack[], label: string) =>
		q.length == 0
			? []
			: [
					<div
						key={label}
						className="font-bold">
						{label}
					</div>,
					...q.map((queueItem, i) => {
						const albImg64 = queueItem.albumOfTrack.coverArt.sources.filter(
							(x) => x.height == 64
						)[0];
						const onclick = () => {
							if (
								queueItem.uri.startsWith("spotify:track") ||
								queueItem.uri.startsWith("spotify:local")
							) {
								return SpotifyClient?.SkipTo({
									active_device_id: curInfo.deviceId,
									uri: queueItem.uri,
									uid: queueItem.uid,
								});
							}
						};
						return (
							<SongCard
								hidden={queueItem.hidden_in_queue}
								albImg={albImg64.url}
								title={queueItem.name}
								artist={queueItem.artists.items
									.map((a) => a.profile.name)
									.join(", ")}
								isExplicit={queueItem.contentRating.label == "EXPLICIT"}
								key={label + "-" + i}
								clickAction={onclick}
							/>
						);
					}),
			  ];

	return (
		<>
			{[
				...NowPlaying,
				...section(ProviderQueue, "Next in queue"),
				...section(ProviderContext, "Next from: " + curInfoExtra.context.name),
			]}
		</>
	);
}
