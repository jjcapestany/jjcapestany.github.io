import {getDate} from "date-fns";


/*THIS FILE IS MADE TO CREATE THE TYPES FOR THE TSX FILE
* THERE IS NO NEED TO EDIT THIS FILE!
* FOCUS ON THE TSX AND STYLING
* */


// TYPES FOR PASSING MOVIE DATA TO THE UI //
export interface CardData {
  day: number;
  title: string;
  image: string;
  url: string;
  isOpen: boolean;
}

export interface apiResponse {
  page: number;
  results: MovieData[];
  total_pages: number;
  total_results: number;
}

export interface MovieData {
  adult: boolean;
  backdrop_path: string;
  genre_ids: number[];
  id: number;
  original_language: string;
  original_title: string;
  overview: string;
  popularity: number;
  poster_path: string;
  release_date: string;
  title: string;
  video: boolean;
  vote_average: number;
  vote_count: number;
}

const options = {
  method: 'GET',
  headers: {
    accept: 'application/json',
    Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJjNGE2YmQyYTIzNDVmOTAzZGFiYzY3NTllMGU4NjJjMyIsIm5iZiI6MTY4MzcyNzczMC45NCwic3ViIjoiNjQ1YmE1NzIxYjcwYWUwMGZkNmNhOTQzIiwic2NvcGVzIjpbImFwaV9yZWFkIl0sInZlcnNpb24iOjF9.c9GpcMTkha9a6TnOuNqFLd6a_QlM4qdO207jXvdsErE'
  }
};


// PARSE THROUGH THE API DATA AND FLATTEN INTO A SINGLE ARRAY FOR USE IN THE DISPLAY OF TSX CARDS //
let count = 0

export const movieDataArray = (await Promise.all([1, 2].map(async (page) => {
  try {
    const response = await (await fetch('https://api.themoviedb.org/3/search/movie?query=christmas&include_adult=false&language=en-US&page=' + `${page}`, options)).json() as apiResponse
    console.log(response)
    return response.results.filter((movieData) => movieData.poster_path !== null).map((movieData): CardData => ({
      day: ++count,
      image: movieData.poster_path,
      url: movieData.poster_path,
      title: movieData.title,
      isOpen: false
    }))
  } catch(error){
    console.log(error)
    return []
  }
}))).flat().slice(0, 25)


// DETERMINE IF THE CARD DATA DAY IS < TODAY AND RETURN BOOLEAN TO DETERMINE WHETHER TO DISPLAY AUTOMATICALLY //
export const doShowCard=(cardData:CardData)=>{
  const today = new Date();
  const datePortion = getDate(today);
  console.log(cardData)
  return cardData.day < datePortion+1 || cardData.isOpen
}