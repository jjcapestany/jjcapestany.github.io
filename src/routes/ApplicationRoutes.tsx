import {createHashRouter} from "react-router-dom";
import LandingPage from "../components/LandingPage.tsx";
import AboutMe from "../components/AboutMe.tsx";

export const router = createHashRouter([
    {
        path: "/",
        element:<LandingPage/>,
    },
    {
        path: "/about-me",
        element:<AboutMe/>,
    }
]);