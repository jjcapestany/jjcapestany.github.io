import {Typography} from "@mui/material";
import Carousel from "react-material-ui-carousel";
import Box from "@mui/material/Box";

function LandingPage() {

    const tarotCards = [
        {
            name: "THE FOOL",
            number: "0",
            description: "Kirby fits THE FOOL as a carefree, ever-curious traveler who embraces adventure without fear. THE FOOL represents new beginnings and limitless potential, much like Kirby’s ability to adapt and absorb new powers. Despite his innocent and playful nature, he faces cosmic threats with unwavering optimism. His journey, like THE FOOL’s, is one of constant discovery, proving that even the smallest hero can shape the fate of worlds.",
            image: "src/assets/0_Fool_Kirby.webp"
        },
    ]

    return (
        <>
            <Typography variant={'h2'} textAlign={'center'} color={'cyan'}>Runeclad's Mighty Tarots</Typography>
            <Box width={'500px'} margin={'auto'}>
                <Carousel stopAutoPlayOnHover={true} height={'650px'}>
                    {tarotCards.map((card, index) => {
                        return (
                            <>
                                <img src={tarotCards[0].image} width={275} style={{
                                    display: 'block',
                                    marginLeft: "auto",
                                    marginRight: 'auto',
                                    borderRadius: '25px',
                                    marginBottom:'10px'
                                }}/>
                                <Typography bgcolor={'whitesmoke'} borderRadius={'25px'} padding={'10px'} textAlign={'center'}>{card.description}</Typography>
                            </>
                        )
                    })}
                </Carousel>
            </Box>
        </>
    )
}

export default LandingPage