// The Reader's journal: 99 pages scattered through the vaults, written by
// someone who got here before you and kept notes. Plain handwriting, no
// flourish. Collect them in rooms; read them on the start screen or at the
// reader in the library.
//
// Pages 1-15 are written. The rest exist and are collectible, but the Reader
// hasn't copied them out clean yet (placeholder text). Fill them in over time
// by editing WRITTEN below.

export const TOTAL_PAGES = 99;

export interface JournalPage {
  id: number;
  title: string;
  text: string;
  written: boolean;
}

// Real entries, keyed by page number. Voice: dry, observational, a little
// tired. Short. Talks about this world the way a person actually would.
const WRITTEN: Record<number, { title: string; text: string }> = {
  1: {
    title: 'How I got in',
    text: "I did not find a door. I found a smell, and I followed it down. Old butter and something burning. By the time I noticed the walls were close I was already three turns deep and the way back had moved. The place rearranges itself when you are not looking at it. I have stopped being surprised by this.",
  },
  2: {
    title: 'The wedge',
    text: "There is a thing down here shaped like a slice of cheese, wearing a hat like a wizard would. It fights. I have seen it kill. It does not talk to me, or it cannot, but it leaves food alone and goes straight for anything with filling in it. I think it is looking for something. I think we both are.",
  },
  3: {
    title: 'The one rule',
    text: "I asked the wedge, out loud, what it wanted. It did not answer. But it stopped at a sandwich somebody left rotting in a corner, looked at it for a long time, and then smashed it flat. There was ham in that sandwich. I am starting to understand that the ham was the problem.",
  },
  4: {
    title: 'Bread, butter, cheese',
    text: "I have worked it out, mostly. The wedge believes a grilled cheese is three things and a hot pan. Bread. Butter. Cheese. That is the whole list. Anything past that line is not a grilled cheese anymore. It is a melt. And a melt, to the wedge, is a lie wearing a sandwich.",
  },
  5: {
    title: 'On melts',
    text: "I used to think this was a small thing to be angry about. Then I met one. A melt is not a meal here. It is alive, and it is wrong, and it knows it is wrong, which is the part that makes it dangerous. They argue. They tell you they are basically a grilled cheese. They are not. Do not let them finish the sentence.",
  },
  6: {
    title: 'The fillings',
    text: "The little ones that swarm are not enemies so much as ingredients that got loose. A tomato that walks. Bacon that runs. A pickle that spits. None of them belong between bread, and all of them think they do. Kill them quick. They are not the point. They are just what the point is made of.",
  },
  7: {
    title: 'The patty',
    text: "First big one I watched the wedge fight was a slab of meat between two slices of grilled bread, calling itself a sandwich. It hits like a truck and it is proud of itself. The wedge took it apart anyway. Stood over it a second after, the way you stand over a thing you have been wanting to say no to for years.",
  },
  8: {
    title: 'Why the rooms move',
    text: "My best guess: this place is not a building. It is more like a fridge that forgot it was supposed to keep things cold. It breathes. Rooms drift. Walk far enough from one and it forgets its own shape and grows a new one. Only a few spots stay put. The library is one of them. Hold onto that.",
  },
  9: {
    title: 'The library',
    text: "There is a room that does not move. One door, walls of shelves, quiet in a way the rest of this place never is. I have been leaving my pages here because it is the only spot I trust to still exist tomorrow. If you are reading this, you found it too. Good. Leave yours here when you have to run.",
  },
  10: {
    title: 'About me',
    text: "I am not going to write my name. Names are how this place gets a grip on you. I came in to find the bottom of it and I have not found it yet. I read more than I fight, which is why I am still writing and not a stain on a wall. Read more than you fight. That is the only advice I have that works.",
  },
  11: {
    title: 'The smell of deep rooms',
    text: "The further down you go the sharper it gets. Not rot. Aging. Like a cheese cave run too long with nobody minding it. The things that live in the deep rooms have been aging too. They are bigger and they glow at the edges and they are not afraid of you. The glow is the only honest warning this place gives.",
  },
  12: {
    title: 'On the hat',
    text: "The wedge changes its hat color depending on how it fights. Gold when it shoots from far. Red when it gets in close with a blade. A blue, veined like old cheese, when it calls down whatever that blast is. I do not think the hat is a choice. I think it is just what kind of cheese it decided to be.",
  },
  13: {
    title: 'The tuna',
    text: "You smell the tuna melt before the room even opens. It keeps its distance and throws hot grease in every direction at once. There is no clever way through it. You close the gap or you leave. I left, the first time. The wedge did not. The wedge does not seem to know the word.",
  },
  14: {
    title: 'What the pages are for',
    text: "I keep asking why I write these down. Nobody asked me to. But every page I finish, the place feels a little less like it is winning. Maybe that is all a journal ever is. A way of saying I was here, I saw it, and I did not let it stay a secret. Ninety-nine of these and maybe the whole thing is said.",
  },
  15: {
    title: 'The bottom',
    text: "I have not seen it. But I have heard the wedge talk about it the only way it talks, which is by walking toward it and never stopping. There is supposed to be one melt down there that is all of them at once. Every filling, every lie, stacked into one. If the wedge ever reaches it, that is the whole argument, settled. I would like to be there. From a safe distance.",
  },
};

// Build the full 99-page list once. Unwritten pages get a thematic placeholder
// so the count stays honest and collecting them still means something.
export const PAGES: JournalPage[] = Array.from({ length: TOTAL_PAGES }, (_, i) => {
  const id = i + 1;
  const w = WRITTEN[id];
  if (w) return { id, title: w.title, text: w.text, written: true };
  return {
    id,
    title: 'Smudged page',
    text: "The damp got to this one before I could copy it clean. The words are still under there somewhere. I will write it out when it dries.",
    written: false,
  };
});

export function getPage(id: number): JournalPage | undefined {
  return PAGES[id - 1];
}
