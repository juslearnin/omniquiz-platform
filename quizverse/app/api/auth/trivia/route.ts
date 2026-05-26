import { NextResponse } from "next/server";

const QUIZ_TRIVIA = [
  "The word 'Trivia' stems from the Latin for 'three roads' (tri-via), representing the intersection of grammar, rhetoric, and logic.",
  "The iconic 'Millennium Mania' circuit recap tracks the shift of cultural property from physical sets to decentralized algorithmic hosting.",
  "The oldest continuous quizzing championships originated within localized collegiate formats before moving to corporate sponsorships.",
  "The term 'Quizmaster' was popularized by radio broadcast circuits in the mid-20th century before anchoring into pub and tavern culture.",
  "Many early brand names and corporate titles were coined by combining linguistic suffixes derived from ancient regional maps."
];

export async function GET() {
  const randomIndex = Math.floor(Math.random() * QUIZ_TRIVIA.length);
  return NextResponse.json({ fact: QUIZ_TRIVIA[randomIndex] });
}