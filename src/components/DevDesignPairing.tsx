import {Card, CardContent, CardMedia, Stack, Typography} from "@mui/material";
import {useEffect, useState} from "react";
import {CardData, movieDataArray} from "../clients/CardData.ts";
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import Button from "@mui/material/Button";

function DevDesignPairing() {

  const [movies, setMovies] = useState<CardData[]>()
  const [isFlipped, setIsFlipped] = useState<boolean[]>(
    [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false]
  )

  useEffect(() => {
    setMovies(movieDataArray)
    console.log(movies)
  }, [movies]);

  return (
    <Stack>
      {movies && movies.map((card, index) => {
        return (
          <>
            {isFlipped[index] ?
            <Card sx={{maxWidth: 345, backgroundColor: '#1F5822', marginBottom: 10}}>
              <Typography textAlign={'center'} color={'white'} variant={"h5"}>{index + 1}</Typography>
              <CardMedia
                sx={{height: 500}}
                image={"https://image.tmdb.org/t/p/original" + card.image}
                title={card.title}
              />
              <CardContent>
                <Typography textAlign={'center'} color={'#F4F3F2'} variant="body2">
                  {card.title}
                </Typography>
                <Typography textAlign={'center'}>
                  <ThumbDownIcon sx={{color: 'pink'}}/>
                  <ThumbUpIcon sx={{color: 'lightgreen'}}/>
                </Typography>
              </CardContent>
            </Card>
              :
              <Card sx={{width: 97, backgroundColor: '#1F5822', marginBottom: 10}}>
                <CardContent>
                  <Button
                    variant={'contained'}
                    color={'success'}
                    onClick={() => {
                      const updatedArray = [...isFlipped]
                      updatedArray[index] = true;
                      setIsFlipped(updatedArray)
                    }}
                  >{index+1}</Button>
                </CardContent>
              </Card>
            }
          </>
        )
      })}
    </Stack>
  )
}

export default DevDesignPairing