import { Request, Response } from 'express';
import * as usersService from './users.service';

export const getUsers = async (_req: Request, res: Response) => {
    res.json(await usersService.getAllUsers());
};

export const createUser = async (req: Request, res: Response) => {
    const user = await usersService.createUser(req.body);
    res.status(201).json(user);
};

export const updateUser = async (req: Request, res: Response) => {
    const user = await usersService.updateUser(req.params.id, req.body);
    res.json(user);
};

export const deleteUser = async (req: Request, res: Response) => {
    await usersService.deleteUser(req.params.id);
    res.status(204).send();
};
