import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import {RouterProvider} from "react-router-dom";
import {router} from "./routes/ApplicationRoutes.tsx";
import ResponsiveAppBar from "./components/ResponsiveAppBar.tsx";


createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ResponsiveAppBar/>
        <RouterProvider router={router}/>
    </StrictMode>,
)
