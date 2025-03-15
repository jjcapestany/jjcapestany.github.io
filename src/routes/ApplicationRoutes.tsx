import {createHashRouter} from "react-router-dom";
import AboutMe from "../components/AboutMe.tsx";
import DevDesignPairing from "../components/DevDesignPairing.tsx";
import LandingPage from "../components/LandingPage.tsx";

export const router = createHashRouter([
    {
        path: "/",
        element:<LandingPage/>,
    },
    {
    }
]);