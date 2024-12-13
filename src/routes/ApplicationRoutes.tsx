import {createHashRouter} from "react-router-dom";
import AboutMe from "../components/AboutMe.tsx";
import DevDesignPairing from "../components/DevDesignPairing.tsx";

export const router = createHashRouter([
    {
        path: "/",
        element:<DevDesignPairing/>,
    },
    {
        path: "/about-me",
        element:<AboutMe/>,
    }
]);