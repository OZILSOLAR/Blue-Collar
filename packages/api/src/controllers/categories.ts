import type { Request, Response } from 'express'
import * as categoryService from '../services/category.service.js'
import { handleError } from '../utils/handleError.js'
import { CategoryResource, CategoryCollection } from '../resources/index.js'
import { ErrorMessages, HttpStatus } from '../constants/index.js'
import { sendSuccess, sendError } from '../utils/response.js'

export async function listCategories(_req: Request, res: Response) {
  try {
    const categories = await categoryService.listCategories()
    return sendSuccess(res, CategoryCollection(categories as any))
  } catch (err) {
    return handleError(res, err)
  }
}

export async function getCategory(req: Request, res: Response) {
  try {
    const category = await categoryService.getCategory(req.params.id as string)
    if (!category) {
      return sendError(res, ErrorMessages.CATEGORY_NOT_FOUND, HttpStatus.NOT_FOUND)
    }
    return sendSuccess(res, CategoryResource(category as any))
  } catch (err) {
    return handleError(res, err)
  }
}
